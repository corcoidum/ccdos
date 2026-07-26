"""Deterministic offline regression eval for answer-layer grounding decisions.

This eval measures fixed payloads against reviewed expectations. It makes no
network or LLM calls, and it never logs answer body text. Passing the eval does
not prove that an answer is safe, complete, or medically correct; human review
and the runtime safety boundaries remain necessary.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

EVAL_DIR = Path(__file__).resolve().parent
REPOSITORY_ROOT = EVAL_DIR.parent
DEFAULT_CASES_PATH = EVAL_DIR / "answer_grounding_cases.json"
DEFAULT_FIXTURES_DIR = EVAL_DIR / "fixtures" / "answer_payloads"
DEFAULT_PUBLIC_INDEX_PATH = REPOSITORY_ROOT / "content" / "public" / "index.json"

# TODO: inline payload 지원 여부는 별도 review 결정 전까지 추가하지 않는다.
# 현재는 case 입력/기대값과 관측 payload를 분리해 회귀 원인을 독립적으로 검토한다.
KNOWN_KINDS = (
    "grounded-answerable",
    "out-of-scope",
    "partial-evidence",
    "empty-index",
)
CASE_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]*$")


class EvalConfigurationError(ValueError):
    """Raised when an eval input is missing, malformed, or outside policy."""


@dataclass(frozen=True)
class GroundingCase:
    case_id: str
    kind: str
    query: str
    provided_sources: frozenset[str]
    expected_mode: str
    expected_reason: str | None = None


@dataclass(frozen=True)
class ScoreResult:
    case_id: str
    kind: str
    passed: bool
    failures: tuple[str, ...]


def _read_json(path: Path) -> Any:
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as error:
        raise EvalConfigurationError(f"cannot read {path}") from error
    if not raw.strip():
        raise EvalConfigurationError(f"{path} is empty")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as error:
        raise EvalConfigurationError(f"{path} is not valid JSON (line {error.lineno}, column {error.colno})") from error


def load_public_source_ids(public_index_path: Path = DEFAULT_PUBLIC_INDEX_PATH) -> frozenset[str]:
    """Return source IDs that passed the repository's public-content pipeline."""
    document = _read_json(public_index_path)
    if not isinstance(document, dict):
        raise EvalConfigurationError("public index must be a JSON object")

    source_ids: set[str] = set()
    for section in ("notes", "glossary"):
        entries = document.get(section, [])
        if not isinstance(entries, list):
            raise EvalConfigurationError(f"public index section {section!r} must be a list")
        for entry in entries:
            if not isinstance(entry, dict) or not isinstance(entry.get("id"), str):
                raise EvalConfigurationError(f"public index section {section!r} contains an invalid entry")
            source_ids.add(entry["id"])
    return frozenset(source_ids)


def _required_string(record: dict[str, Any], field: str, case_number: int) -> str:
    value = record.get(field)
    if not isinstance(value, str) or not value.strip():
        raise EvalConfigurationError(f"case #{case_number} field {field!r} must be a non-empty string")
    return value


def _parse_case(record: object, case_number: int, public_source_ids: frozenset[str]) -> GroundingCase:
    if not isinstance(record, dict):
        raise EvalConfigurationError(f"case #{case_number} must be a JSON object")

    case_id = _required_string(record, "id", case_number)
    if not CASE_ID_PATTERN.fullmatch(case_id):
        raise EvalConfigurationError(f"case #{case_number} has an invalid id")

    kind = _required_string(record, "kind", case_number)
    if kind not in KNOWN_KINDS:
        raise EvalConfigurationError(f"case {case_id!r} has unknown kind {kind!r}")

    query = _required_string(record, "query", case_number)
    provided_sources = record.get("provided_sources")
    if not isinstance(provided_sources, list) or any(not isinstance(item, str) for item in provided_sources):
        raise EvalConfigurationError(f"case {case_id!r} provided_sources must be a list of strings")
    if len(provided_sources) != len(set(provided_sources)):
        raise EvalConfigurationError(f"case {case_id!r} contains duplicate provided_sources")
    if any(source_id not in public_source_ids for source_id in provided_sources):
        # 승인되지 않은 ID 자체는 출력하지 않는다. 비공개 ID가 로그로 새는 길도 닫는다.
        raise EvalConfigurationError(f"case {case_id!r} references a source outside the approved public index")

    expectation = record.get("expect")
    if not isinstance(expectation, dict):
        raise EvalConfigurationError(f"case {case_id!r} expect must be a JSON object")
    expected_mode = expectation.get("mode")
    if expected_mode not in {"generated", "retrieval"}:
        raise EvalConfigurationError(f"case {case_id!r} expect.mode must be generated or retrieval")
    expected_reason = expectation.get("reason")
    if expected_reason is not None and (not isinstance(expected_reason, str) or not expected_reason):
        raise EvalConfigurationError(f"case {case_id!r} expect.reason must be a non-empty string")

    if kind == "grounded-answerable" and expected_mode != "generated":
        raise EvalConfigurationError(f"case {case_id!r} grounded-answerable must expect generated mode")
    if kind in {"out-of-scope", "empty-index"} and (
        expected_mode != "retrieval" or expected_reason != "no_sources"
    ):
        raise EvalConfigurationError(f"case {case_id!r} {kind} must expect retrieval/no_sources")
    if kind == "empty-index" and provided_sources:
        raise EvalConfigurationError(f"case {case_id!r} empty-index must not provide sources")

    return GroundingCase(
        case_id=case_id,
        kind=kind,
        query=query,
        provided_sources=frozenset(provided_sources),
        expected_mode=expected_mode,
        expected_reason=expected_reason,
    )


def load_cases(
    cases_path: Path = DEFAULT_CASES_PATH,
    public_index_path: Path = DEFAULT_PUBLIC_INDEX_PATH,
) -> list[GroundingCase]:
    """Load and validate a non-empty case set against approved public IDs."""
    document = _read_json(cases_path)
    if not isinstance(document, list):
        raise EvalConfigurationError("case set must be a JSON array")
    if not document:
        raise EvalConfigurationError("case set has no cases")

    public_source_ids = load_public_source_ids(public_index_path)
    cases = [_parse_case(record, number, public_source_ids) for number, record in enumerate(document, start=1)]
    case_ids = [case.case_id for case in cases]
    if len(case_ids) != len(set(case_ids)):
        raise EvalConfigurationError("case ids must be unique")
    return cases


def load_payload(case: GroundingCase, fixtures_dir: Path = DEFAULT_FIXTURES_DIR) -> dict[str, Any]:
    """Load a metadata-only response fixture without answer body text."""
    document = _read_json(fixtures_dir / f"{case.case_id}.json")
    if not isinstance(document, dict):
        raise EvalConfigurationError(f"payload fixture for {case.case_id!r} must be a JSON object")
    return document


def score_case(case: GroundingCase, payload: dict[str, Any]) -> ScoreResult:
    """Compare response mode, reason, and citations without inspecting answer text."""
    failures: list[str] = []
    actual_mode = payload.get("mode")
    if actual_mode != case.expected_mode:
        failures.append(f"mode expected {case.expected_mode!r}, got {actual_mode!r}")

    if case.expected_reason is not None:
        actual_reason = payload.get("reason")
        if actual_reason != case.expected_reason:
            failures.append(f"reason expected {case.expected_reason!r}, got {actual_reason!r}")

    if actual_mode == "generated":
        citations = payload.get("citations")
        if not isinstance(citations, list) or not citations or any(not isinstance(item, str) for item in citations):
            failures.append("generated payload must contain a non-empty string citations list")
        else:
            outside_count = len(set(citations) - case.provided_sources)
            if outside_count:
                # 허용 밖 ID는 민감할 수 있으므로 값 대신 개수만 보고한다.
                failures.append(f"citations contain {outside_count} source(s) outside provided_sources")

    return ScoreResult(
        case_id=case.case_id,
        kind=case.kind,
        passed=not failures,
        failures=tuple(failures),
    )


def _print_report(results: list[ScoreResult], min_pass: float) -> bool:
    for result in results:
        status = "PASS" if result.passed else "FAIL"
        detail = "" if result.passed else f": {'; '.join(result.failures)}"
        print(f"{status} [{result.kind}] {result.case_id}{detail}")

    print("\nPass rate by kind")
    for kind in KNOWN_KINDS:
        kind_results = [result for result in results if result.kind == kind]
        passed = sum(result.passed for result in kind_results)
        rate = passed / len(kind_results) if kind_results else 0.0
        print(f"- {kind}: {passed}/{len(kind_results)} ({rate:.1%})")

    passed_count = sum(result.passed for result in results)
    overall_rate = passed_count / len(results)
    print(f"Overall: {passed_count}/{len(results)} ({overall_rate:.1%}); required {min_pass:.1%}")

    out_of_scope_failed = any(not result.passed and result.kind == "out-of-scope" for result in results)
    if out_of_scope_failed:
        print("FAIL: every out-of-scope case must pass")
        return False
    if overall_rate < min_pass:
        print("FAIL: overall pass rate is below the configured threshold")
        return False
    if passed_count < len(results):
        print("WARN: non-critical failures were tolerated by the configured threshold")
    else:
        print("PASS: grounding eval gate passed")
    return True


def run_eval(
    cases_path: Path,
    fixtures_dir: Path,
    public_index_path: Path,
    min_pass: float,
) -> bool:
    """Run fixed cases and return whether the regression gate passes."""
    cases = load_cases(cases_path, public_index_path)
    results = [score_case(case, load_payload(case, fixtures_dir)) for case in cases]
    return _print_report(results, min_pass)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the deterministic offline grounding regression eval.")
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES_PATH)
    parser.add_argument("--fixtures", type=Path, default=DEFAULT_FIXTURES_DIR)
    parser.add_argument("--public-index", type=Path, default=DEFAULT_PUBLIC_INDEX_PATH)
    parser.add_argument("--min-pass", type=float, default=1.0)
    args = parser.parse_args(argv)

    if not 0.0 <= args.min_pass <= 1.0:
        print("FAIL: --min-pass must be between 0.0 and 1.0", file=sys.stderr)
        return 1

    try:
        passed = run_eval(args.cases, args.fixtures, args.public_index, args.min_pass)
    except EvalConfigurationError as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
