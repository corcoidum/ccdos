from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from automation.validate_notes import (
    collect_duplicate_id_issues,
    load_and_validate_notes,
    parse_frontmatter,
    validate_note,
)

VALID_NOTE = """---
id: safe-test-note
title: Safe test note
created: 2026-07-10T00:00:00Z
updated: 2026-07-10T00:00:00Z
classification: S0_PUBLIC
visibility: public
publish_state: draft
tags:
  - test
---

# Safe body
"""


class ValidateNotesTests(unittest.TestCase):
    def write_note(self, directory: Path, content: str) -> Path:
        path = directory / "CORCOIDUM-Public" / "00_Drafts" / "note.md"
        path.parent.mkdir(parents=True)
        path.write_text(content, encoding="utf-8")
        return path

    def test_parses_template_style_frontmatter(self) -> None:
        metadata, body = parse_frontmatter(VALID_NOTE)
        self.assertEqual(metadata["tags"], ["test"])
        self.assertIn("Safe body", body)

    def test_parses_inline_list_frontmatter(self) -> None:
        content = VALID_NOTE.replace("tags:\n  - test", 'tags: [test, "case-study"]')
        metadata, _ = parse_frontmatter(content)
        self.assertEqual(metadata["tags"], ["test", "case-study"])

    def test_parses_relation_objects(self) -> None:
        content = VALID_NOTE.replace(
            "tags:\n  - test",
            """tags:
  - test
relations:
  - target: another-public-note
    type: related_to""",
        )
        metadata, _ = parse_frontmatter(content)
        self.assertEqual(metadata["relations"], [{"target": "another-public-note", "type": "related_to"}])

    def test_rejects_frontmatter_field_without_value(self) -> None:
        content = VALID_NOTE.replace("title: Safe test note", "title:")
        with self.assertRaises(ValueError):
            parse_frontmatter(content)

    def test_rejects_duplicate_note_ids_across_files(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            directory = Path(temp_dir) / "CORCOIDUM-Public" / "00_Drafts"
            directory.mkdir(parents=True)
            first = directory / "first.md"
            second = directory / "second.md"
            first.write_text(VALID_NOTE, encoding="utf-8")
            second.write_text(VALID_NOTE, encoding="utf-8")
            issues = collect_duplicate_id_issues([first, second])
        self.assertEqual(len(issues), 1)
        self.assertIn("duplicate note id 'safe-test-note'", issues[0].message)
        self.assertIn("second.md", issues[0].message)

    def test_accepts_valid_public_draft(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            self.assertEqual(validate_note(self.write_note(Path(temp_dir), VALID_NOTE)), [])

    def test_rejects_public_note_without_required_approval_metadata(self) -> None:
        content = VALID_NOTE.replace("publish_state: draft", "publish_state: approved")
        with tempfile.TemporaryDirectory() as temp_dir:
            messages = [issue.message for issue in validate_note(self.write_note(Path(temp_dir), content))]
        self.assertIn("approved note requires approved_by", messages)
        self.assertIn("approved note requires approved_at", messages)

    def test_rejects_public_review_without_privacy_evidence(self) -> None:
        content = VALID_NOTE.replace("publish_state: draft", "publish_state: review")
        with tempfile.TemporaryDirectory() as temp_dir:
            messages = [issue.message for issue in validate_note(self.write_note(Path(temp_dir), content))]
        self.assertTrue(any("public review note missing fields" in message for message in messages))

    def test_accepts_approved_public_note_with_current_review_evidence(self) -> None:
        content = VALID_NOTE.replace(
            "publish_state: draft",
            """publish_state: approved
approved_by: content-owner
approved_at: 2026-07-10T02:00:00Z
review_requested_at: 2026-07-10T00:30:00Z
privacy_reviewed_by: privacy-reviewer
privacy_reviewed_at: 2026-07-10T01:00:00Z
privacy_review_result: passed
reviewed_revision: 2026-07-10T00:00:00Z""",
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            self.assertEqual(validate_note(self.write_note(Path(temp_dir), content)), [])

    def test_rejects_approved_note_changed_after_review(self) -> None:
        content = VALID_NOTE.replace(
            "publish_state: draft",
            """publish_state: approved
approved_by: content-owner
approved_at: 2026-07-10T02:00:00Z
review_requested_at: 2026-07-10T00:30:00Z
privacy_reviewed_by: privacy-reviewer
privacy_reviewed_at: 2026-07-10T01:00:00Z
privacy_review_result: passed
reviewed_revision: 2026-07-09T00:00:00Z""",
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            messages = [issue.message for issue in validate_note(self.write_note(Path(temp_dir), content))]
        self.assertIn("reviewed_revision must equal updated; changed content must return to review", messages)

    def test_rejects_published_at_before_approved_at(self) -> None:
        content = VALID_NOTE.replace(
            "publish_state: draft",
            """publish_state: published
approved_by: content-owner
approved_at: 2026-07-10T02:00:00Z
published_at: 2026-07-10T01:30:00Z
review_requested_at: 2026-07-10T00:30:00Z
privacy_reviewed_by: privacy-reviewer
privacy_reviewed_at: 2026-07-10T01:00:00Z
privacy_review_result: passed
reviewed_revision: 2026-07-10T00:00:00Z""",
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            messages = [issue.message for issue in validate_note(self.write_note(Path(temp_dir), content))]
        self.assertIn("published_at must not be earlier than approved_at", messages)

    def test_rejects_sensitive_pattern(self) -> None:
        content = VALID_NOTE + "\nSynthetic contact: 010-1234-5678\n"
        with tempfile.TemporaryDirectory() as temp_dir:
            messages = [issue.message for issue in validate_note(self.write_note(Path(temp_dir), content))]
        self.assertTrue(any("Korean mobile phone number" in message for message in messages))

    def test_rejects_sensitive_fixture(self) -> None:
        root = Path(__file__).resolve().parent
        messages = [issue.message for issue in validate_note(root / "fixtures" / "invalid-sensitive-note.md")]
        self.assertTrue(any("Korean mobile phone number" in message for message in messages))

    def test_rejects_wrong_vault_classification(self) -> None:
        content = VALID_NOTE.replace("classification: S0_PUBLIC", "classification: S1_PRIVATE")
        with tempfile.TemporaryDirectory() as temp_dir:
            messages = [issue.message for issue in validate_note(self.write_note(Path(temp_dir), content))]
        self.assertIn("CORCOIDUM-Public requires S0_PUBLIC", messages)


if __name__ == "__main__":
    unittest.main()


APPROVAL_LINES = """review_requested_at: 2026-07-10T00:10:00Z
privacy_reviewed_by: synthetic-reviewer
privacy_reviewed_at: 2026-07-10T00:20:00Z
privacy_review_result: passed
reviewed_revision: 2026-07-10T00:00:00Z
approved_by: synthetic-owner
approved_at: 2026-07-10T00:30:00Z"""


def approved_record(note_id: str, *, relations: list[tuple[str, str]] | None = None) -> str:
    lines = [
        "---",
        f"id: {note_id}",
        f"title: Record {note_id}",
        "created: 2026-07-10T00:00:00Z",
        "updated: 2026-07-10T00:00:00Z",
        "classification: S0_PUBLIC",
        "visibility: public",
        "publish_state: approved",
        APPROVAL_LINES,
        "tags:",
        "  - test",
    ]
    if relations:
        lines.append("relations:")
        for target, relation_type in relations:
            lines.extend([f"  - target: {target}", f"    type: {relation_type}"])
    return "\n".join([*lines, "---", "", "본문이다.", ""])


def approved_term(term_id: str, aliases: list[str], *, relations: list[tuple[str, str]] | None = None) -> str:
    lines = [
        "---",
        f"id: {term_id}",
        f"title: Term {term_id}",
        "created: 2026-07-10T00:00:00Z",
        "updated: 2026-07-10T00:00:00Z",
        "classification: S0_PUBLIC",
        "visibility: public",
        "publish_state: approved",
        APPROVAL_LINES,
        "note_kind: glossary",
        "aliases:",
        *[f"  - {alias}" for alias in aliases],
        "tags:",
        "  - glossary",
    ]
    if relations:
        lines.append("relations:")
        for target, relation_type in relations:
            lines.extend([f"  - target: {target}", f"    type: {relation_type}"])
    return "\n".join([*lines, "---", "", "용어 설명이다.", ""])


class GlossaryRelationBoundaryTests(unittest.TestCase):
    """용어는 그래프 node가 아니다(ADR-0009). 관계 선언은 검증에서 막혀야 한다."""

    def issues_for(self, files: dict[str, str]) -> list[str]:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "CORCOIDUM-Public" / "00_Drafts"
            source.mkdir(parents=True)
            paths = []
            for name, text in files.items():
                path = source / name
                path.write_text(text, encoding="utf-8")
                paths.append(path)
            _, issues = load_and_validate_notes(paths)
            return [issue.message for issue in issues]

    def test_record_may_not_point_a_relation_at_a_glossary_term(self) -> None:
        messages = self.issues_for(
            {
                "record.md": approved_record("r-one", relations=[("t-fallback", "related_to")]),
                "term.md": approved_term("t-fallback", ["폴백"]),
            }
        )
        self.assertTrue(any("glossary_target_is_not_a_graph_node" in message for message in messages), messages)

    def test_glossary_term_may_not_declare_relations(self) -> None:
        messages = self.issues_for(
            {
                "record.md": approved_record("r-one"),
                "term.md": approved_term("t-fallback", ["폴백"], relations=[("r-one", "related_to")]),
            }
        )
        self.assertTrue(
            any("glossary_note_must_not_declare_relations" in message for message in messages), messages
        )

    def test_record_to_record_relations_stay_allowed(self) -> None:
        messages = self.issues_for(
            {
                "one.md": approved_record("r-one", relations=[("r-two", "related_to")]),
                "two.md": approved_record("r-two"),
                "term.md": approved_term("t-fallback", ["폴백"]),
            }
        )
        self.assertEqual(messages, [])
