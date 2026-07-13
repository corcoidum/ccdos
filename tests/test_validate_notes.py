from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from automation.validate_notes import collect_duplicate_id_issues, parse_frontmatter, validate_note


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
