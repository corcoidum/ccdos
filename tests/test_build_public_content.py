from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from automation.build_public_content import build_payload, main

APPROVED_NOTE = """---
id: approved-case-study
title: Approved case study
created: 2026-07-10T00:00:00Z
updated: 2026-07-10T00:00:00Z
classification: S0_PUBLIC
visibility: public
publish_state: approved
tags:
  - case-study
review_requested_at: 2026-07-10T00:10:00Z
privacy_reviewed_by: privacy-reviewer
privacy_reviewed_at: 2026-07-10T00:20:00Z
privacy_review_result: passed
reviewed_revision: 2026-07-10T00:00:00Z
approved_by: content-owner
approved_at: 2026-07-10T00:30:00Z
---

# Safe public summary

This is an approved synthetic example.
"""

DRAFT_NOTE = APPROVED_NOTE.replace("id: approved-case-study", "id: draft-case-study").replace(
    "publish_state: approved", "publish_state: draft"
)


class BuildPublicContentTests(unittest.TestCase):
    def write_note(self, directory: Path, name: str, content: str) -> Path:
        path = directory / "CORCOIDUM-Public" / "00_Drafts" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def test_build_payload_includes_only_approved_notes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "CORCOIDUM-Public"
            self.write_note(Path(temp_dir), "approved.md", APPROVED_NOTE)
            self.write_note(Path(temp_dir), "draft.md", DRAFT_NOTE)
            payload = build_payload(source)
        self.assertEqual([note["id"] for note in payload["notes"]], ["approved-case-study"])

    def test_build_payload_rejects_duplicate_note_ids(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "CORCOIDUM-Public"
            self.write_note(Path(temp_dir), "first.md", APPROVED_NOTE)
            self.write_note(Path(temp_dir), "second.md", APPROVED_NOTE)
            with self.assertRaisesRegex(ValueError, "duplicate note id"):
                build_payload(source)

    def test_check_detects_stale_generated_index(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "CORCOIDUM-Public"
            output = root / "content" / "index.json"
            self.write_note(root, "approved.md", APPROVED_NOTE)
            self.assertEqual(main(["--source", str(source), "--output", str(output)]), 0)
            self.assertEqual(main(["--source", str(source), "--output", str(output), "--check"]), 0)
            output.write_text("{}\n", encoding="utf-8")
            self.assertEqual(main(["--source", str(source), "--output", str(output), "--check"]), 1)
            self.assertEqual(json.loads(output.read_text(encoding="utf-8")), {})


if __name__ == "__main__":
    unittest.main()
