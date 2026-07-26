"""Unit tests for the deterministic offline grounding scorer."""

from __future__ import annotations

import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

from evals.grounding_eval import EvalConfigurationError, GroundingCase, load_cases, main, score_case


def make_case(
    *,
    case_id: str = "case-01",
    kind: str = "grounded-answerable",
    provided_sources: frozenset[str] = frozenset({"public-note"}),
    expected_mode: str = "generated",
    expected_reason: str | None = None,
) -> GroundingCase:
    return GroundingCase(
        case_id=case_id,
        kind=kind,
        query="합성 테스트 질문",
        provided_sources=provided_sources,
        expected_mode=expected_mode,
        expected_reason=expected_reason,
    )


class ScoreGroundingCaseTest(unittest.TestCase):
    def test_out_of_scope_generated_response_fails(self) -> None:
        case = make_case(
            kind="out-of-scope",
            expected_mode="retrieval",
            expected_reason="no_sources",
        )

        result = score_case(case, {"mode": "generated", "citations": ["public-note"]})

        self.assertFalse(result.passed)
        self.assertTrue(any("mode expected" in failure for failure in result.failures))

    def test_citation_outside_provided_sources_fails(self) -> None:
        case = make_case()

        result = score_case(case, {"mode": "generated", "citations": ["unapproved-note"]})

        self.assertFalse(result.passed)
        self.assertTrue(any("outside provided_sources" in failure for failure in result.failures))
        self.assertNotIn("unapproved-note", " ".join(result.failures))

    def test_grounded_generated_response_passes(self) -> None:
        case = make_case()

        result = score_case(case, {"mode": "generated", "citations": ["public-note"]})

        self.assertTrue(result.passed)
        self.assertEqual(result.failures, ())

    def test_empty_index_fallback_passes(self) -> None:
        case = make_case(
            kind="empty-index",
            provided_sources=frozenset(),
            expected_mode="retrieval",
            expected_reason="no_sources",
        )

        result = score_case(case, {"mode": "retrieval", "reason": "no_sources", "citations": []})

        self.assertTrue(result.passed)


class LoadGroundingCasesTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.public_index_path = self.root / "index.json"
        self.public_index_path.write_text(
            json.dumps({"notes": [{"id": "public-note"}], "glossary": []}),
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def write_cases(self, cases: object) -> Path:
        path = self.root / "cases.json"
        path.write_text(json.dumps(cases, ensure_ascii=False), encoding="utf-8")
        return path

    def valid_case(self, **overrides: object) -> dict[str, object]:
        record: dict[str, object] = {
            "id": "grounded-01",
            "kind": "grounded-answerable",
            "query": "공개 근거로 답할 수 있는 합성 질문",
            "provided_sources": ["public-note"],
            "expect": {"mode": "generated"},
        }
        record.update(overrides)
        return record

    def test_private_source_id_is_rejected_without_echoing_id(self) -> None:
        private_id = "private-vault-note"
        cases_path = self.write_cases([self.valid_case(provided_sources=[private_id])])

        with self.assertRaises(EvalConfigurationError) as caught:
            load_cases(cases_path, self.public_index_path)

        self.assertNotIn(private_id, str(caught.exception))
        self.assertIn("outside the approved public index", str(caught.exception))

    def test_empty_file_is_rejected(self) -> None:
        cases_path = self.root / "cases.json"
        cases_path.write_text("", encoding="utf-8")

        with self.assertRaisesRegex(EvalConfigurationError, "is empty"):
            load_cases(cases_path, self.public_index_path)

    def test_empty_case_list_is_rejected(self) -> None:
        cases_path = self.write_cases([])

        with self.assertRaisesRegex(EvalConfigurationError, "has no cases"):
            load_cases(cases_path, self.public_index_path)

    def test_unknown_kind_is_rejected(self) -> None:
        cases_path = self.write_cases([self.valid_case(kind="new-unknown-kind")])

        with self.assertRaisesRegex(EvalConfigurationError, "unknown kind"):
            load_cases(cases_path, self.public_index_path)


class GroundingEvalGateTest(unittest.TestCase):
    def test_out_of_scope_failure_exits_one_even_below_overall_threshold(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            fixtures = root / "fixtures"
            fixtures.mkdir()
            index_path = root / "index.json"
            cases_path = root / "cases.json"
            index_path.write_text(
                json.dumps({"notes": [{"id": "public-note"}], "glossary": []}),
                encoding="utf-8",
            )
            cases_path.write_text(
                json.dumps(
                    [
                        {
                            "id": "oos-01",
                            "kind": "out-of-scope",
                            "query": "합성 범위 밖 질문",
                            "provided_sources": ["public-note"],
                            "expect": {"mode": "retrieval", "reason": "no_sources"},
                        }
                    ],
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            secret_body = "THIS_ANSWER_BODY_MUST_NOT_BE_LOGGED"
            (fixtures / "oos-01.json").write_text(
                json.dumps(
                    {
                        "mode": "generated",
                        "citations": ["public-note"],
                        "answer": secret_body,
                    }
                ),
                encoding="utf-8",
            )
            stdout = io.StringIO()
            stderr = io.StringIO()

            with redirect_stdout(stdout), redirect_stderr(stderr):
                exit_code = main(
                    [
                        "--cases",
                        str(cases_path),
                        "--fixtures",
                        str(fixtures),
                        "--public-index",
                        str(index_path),
                        "--min-pass",
                        "0.0",
                    ]
                )

        self.assertEqual(exit_code, 1)
        self.assertNotIn(secret_body, stdout.getvalue())
        self.assertNotIn(secret_body, stderr.getvalue())
        self.assertIn("every out-of-scope case must pass", stdout.getvalue())


if __name__ == "__main__":
    unittest.main()
