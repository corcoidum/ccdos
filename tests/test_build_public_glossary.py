from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from automation.build_public_content import build_payload as build_content_payload
from automation.build_public_content import render_payload as render_content_payload
from automation.build_public_glossary import (
    build_payload,
    main,
    render_payload,
    resolve_mentions,
    term_summary,
    validate_glossary_payload,
)

APPROVAL_LINES = [
    "review_requested_at: 2026-07-10T00:10:00Z",
    "privacy_reviewed_by: synthetic-reviewer",
    "privacy_reviewed_at: 2026-07-10T00:20:00Z",
    "privacy_review_result: passed",
    "reviewed_revision: 2026-07-10T00:00:00Z",
    "approved_by: synthetic-owner",
    "approved_at: 2026-07-10T00:30:00Z",
]


def synthetic_record(note_id: str, body: str, *, state: str = "approved") -> str:
    lines = [
        "---",
        f"id: {note_id}",
        f"title: Synthetic {note_id}",
        "created: 2026-07-10T00:00:00Z",
        "updated: 2026-07-10T00:00:00Z",
        "classification: S0_PUBLIC",
        "visibility: public",
        f"publish_state: {state}",
        "tags:",
        "  - synthetic",
    ]
    if state in {"approved", "published"}:
        lines.extend(APPROVAL_LINES)
    return "\n".join([*lines, "---", "", body, ""])


def synthetic_term(term_id: str, aliases: list[str], body: str, *, state: str = "approved") -> str:
    lines = [
        "---",
        f"id: {term_id}",
        f"title: Term {term_id}",
        "created: 2026-07-10T00:00:00Z",
        "updated: 2026-07-10T00:00:00Z",
        "classification: S0_PUBLIC",
        "visibility: public",
        f"publish_state: {state}",
        "note_kind: glossary",
        "aliases:",
        *[f"  - {alias}" for alias in aliases],
        "tags:",
        "  - glossary",
    ]
    if state in {"approved", "published"}:
        lines.extend(APPROVAL_LINES)
    return "\n".join([*lines, "---", "", body, ""])


def write_vault(directory: Path, files: dict[str, str]) -> Path:
    source = directory / "CORCOIDUM-Public"
    source.mkdir(parents=True, exist_ok=True)
    for name, text in files.items():
        (source / name).write_text(text, encoding="utf-8")
    return source


class ResolveMentionsTest(unittest.TestCase):
    def terms(self, *entries: tuple[str, list[str]]) -> list[dict[str, object]]:
        return [{"id": term_id, "title": term_id, "summary": "s", "aliases": sorted(aliases)} for term_id, aliases in entries]

    def test_korean_particle_follows_the_alias_and_stays_outside_the_span(self) -> None:
        mentions = resolve_mentions("폴백이 정상인지 확인했다.", self.terms(("t-fallback", ["폴백"])))
        self.assertEqual([mention["alias"] for mention in mentions], ["폴백"])
        self.assertIn("[폴백]이", mentions[0]["context"])

    def test_every_particle_form_matches_without_declaring_them(self) -> None:
        for sentence in ("폴백을 만들었다", "폴백으로 대체했다", "폴백은 눈을 가린다", "폴백의 값"):
            with self.subTest(sentence=sentence):
                mentions = resolve_mentions(sentence, self.terms(("t-fallback", ["폴백"])))
                self.assertEqual(len(mentions), 1)

    def test_only_the_first_occurrence_of_a_term_is_returned(self) -> None:
        mentions = resolve_mentions("폴백과 폴백과 폴백", self.terms(("t-fallback", ["폴백"])))
        self.assertEqual(len(mentions), 1)

    def test_longer_alias_wins_over_a_shorter_one_inside_it(self) -> None:
        terms = self.terms(("t-build", ["결정론적 빌드"]), ("t-short", ["빌드"]))
        mentions = resolve_mentions("결정론적 빌드는 재현된다.", terms)
        self.assertEqual([mention["term"] for mention in mentions], ["t-build"])

    def test_shorter_term_still_matches_when_it_appears_elsewhere(self) -> None:
        terms = self.terms(("t-build", ["결정론적 빌드"]), ("t-short", ["빌드"]))
        mentions = resolve_mentions("결정론적 빌드는 재현된다. 빌드 로그를 본다.", terms)
        self.assertEqual(sorted(mention["term"] for mention in mentions), ["t-build", "t-short"])

    def test_context_marks_the_matched_span_for_review(self) -> None:
        mentions = resolve_mentions("노트북을 열었다", self.terms(("t-note", ["노트"])))
        self.assertIn("[노트]북", mentions[0]["context"])

    def test_absent_alias_produces_no_mention(self) -> None:
        self.assertEqual(resolve_mentions("관련 없는 문장", self.terms(("t-fallback", ["폴백"]))), [])


class TermSummaryTest(unittest.TestCase):
    def test_summary_uses_the_first_paragraph_only(self) -> None:
        self.assertEqual(term_summary("첫 문단이다.\n\n둘째 문단이다."), "첫 문단이다.")

    def test_long_summary_is_truncated_with_an_ellipsis(self) -> None:
        summary = term_summary("가" * 200)
        self.assertTrue(summary.endswith("…"))
        self.assertLessEqual(len(summary), 121)


class BuildPayloadTest(unittest.TestCase):
    def build(self, files: dict[str, str]) -> dict[str, object]:
        with tempfile.TemporaryDirectory() as directory:
            return build_payload(write_vault(Path(directory), files))

    def test_glossary_terms_annotate_records_but_never_themselves(self) -> None:
        payload = self.build(
            {
                "term.md": synthetic_term("t-fallback", ["폴백"], "폴백은 대체 동작이다."),
                "record.md": synthetic_record("r-one", "우아한 폴백이 장애를 숨겼다."),
            }
        )
        self.assertEqual([term["id"] for term in payload["terms"]], ["t-fallback"])
        self.assertEqual([mention["note"] for mention in payload["mentions"]], ["r-one"])

    def test_draft_terms_are_not_published(self) -> None:
        payload = self.build(
            {
                "term.md": synthetic_term("t-fallback", ["폴백"], "폴백은 대체 동작이다.", state="draft"),
                "record.md": synthetic_record("r-one", "우아한 폴백이 장애를 숨겼다."),
            }
        )
        self.assertEqual(payload["terms"], [])
        self.assertEqual(payload["mentions"], [])

    def test_draft_records_are_not_annotated(self) -> None:
        payload = self.build(
            {
                "term.md": synthetic_term("t-fallback", ["폴백"], "폴백은 대체 동작이다."),
                "record.md": synthetic_record("r-one", "우아한 폴백이 장애를 숨겼다.", state="draft"),
            }
        )
        self.assertEqual(payload["mentions"], [])

    def test_payload_is_deterministic(self) -> None:
        files = {
            "term-a.md": synthetic_term("t-alpha", ["폴백"], "폴백은 대체 동작이다."),
            "term-b.md": synthetic_term("t-beta", ["게이트"], "게이트는 검사 묶음이다."),
            "record.md": synthetic_record("r-one", "게이트가 폴백을 검사한다."),
        }
        self.assertEqual(render_payload(self.build(files)), render_payload(self.build(files)))


class GlossaryArtifactValidationTest(unittest.TestCase):
    def payload(self) -> dict[str, object]:
        return {
            "version": 1,
            "terms": [{"id": "t-one", "title": "T", "summary": "s", "aliases": ["폴백"]}],
            "mentions": [{"note": "r-one", "term": "t-one", "alias": "폴백", "context": "[폴백]이"}],
        }

    def test_valid_payload_passes(self) -> None:
        validate_glossary_payload(self.payload())

    def test_mention_alias_must_be_declared_by_its_term(self) -> None:
        payload = self.payload()
        payload["mentions"][0]["alias"] = "게이트"
        with self.assertRaises(ValueError):
            validate_glossary_payload(payload)

    def test_mention_may_not_repeat_a_term_inside_one_note(self) -> None:
        payload = self.payload()
        payload["mentions"].append(dict(payload["mentions"][0]))
        with self.assertRaises(ValueError):
            validate_glossary_payload(payload)

    def test_context_must_show_the_matched_alias(self) -> None:
        payload = self.payload()
        payload["mentions"][0]["context"] = "문맥이 없다"
        with self.assertRaises(ValueError):
            validate_glossary_payload(payload)

    def test_two_terms_may_not_claim_the_same_alias(self) -> None:
        payload = self.payload()
        payload["terms"].append({"id": "t-two", "title": "T2", "summary": "s", "aliases": ["폴백"]})
        with self.assertRaises(ValueError):
            validate_glossary_payload(payload)

    def test_unsorted_terms_are_rejected(self) -> None:
        payload = self.payload()
        payload["terms"] = [
            {"id": "t-two", "title": "T2", "summary": "s", "aliases": ["게이트"]},
            *payload["terms"],
        ]
        payload["mentions"] = []
        with self.assertRaises(ValueError):
            validate_glossary_payload(payload)


class GlossaryCommandTest(unittest.TestCase):
    def test_check_fails_on_a_stale_artifact_and_passes_after_a_build(self) -> None:
        files = {
            "term.md": synthetic_term("t-fallback", ["폴백"], "폴백은 대체 동작이다."),
            "record.md": synthetic_record("r-one", "우아한 폴백이 장애를 숨겼다."),
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = write_vault(root, files)
            index = root / "index.json"
            output = root / "glossary.json"
            index.write_text(render_content_payload(build_content_payload(source)), encoding="utf-8")

            arguments = ["--source", str(source), "--index", str(index), "--output", str(output)]
            self.assertEqual(main([*arguments, "--check"]), 1)
            self.assertEqual(main(arguments), 0)
            self.assertEqual(main([*arguments, "--check"]), 0)

            payload = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(payload["mentions"][0]["note"], "r-one")

    def test_build_fails_when_the_content_index_is_stale(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = write_vault(root, {"record.md": synthetic_record("r-one", "본문이다.")})
            index = root / "index.json"
            index.write_text('{"version": 2, "notes": [], "glossary": []}\n', encoding="utf-8")
            self.assertEqual(main(["--source", str(source), "--index", str(index), "--output", str(root / "g.json")]), 1)


if __name__ == "__main__":
    unittest.main()
