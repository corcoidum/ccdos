"""Keep the shared note template from drifting between its two locations."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Obsidian inserts the template from the vault path; the repository documents the
# templates/ set. Both files must stay byte-identical so neither copy silently wins.
ROOT_TEMPLATE = ROOT / "templates" / "CORCOIDUM-Public-note.md"
VAULT_TEMPLATE = ROOT / "vaults" / "CORCOIDUM-Public" / "99_Templates" / "CORCOIDUM-Public-note.md"


class PublicNoteTemplateTests(unittest.TestCase):
    def test_both_template_copies_exist(self) -> None:
        self.assertTrue(ROOT_TEMPLATE.is_file(), f"missing {ROOT_TEMPLATE}")
        self.assertTrue(VAULT_TEMPLATE.is_file(), f"missing {VAULT_TEMPLATE}")

    def test_template_copies_are_identical(self) -> None:
        self.assertEqual(
            ROOT_TEMPLATE.read_text(encoding="utf-8"),
            VAULT_TEMPLATE.read_text(encoding="utf-8"),
            "templates/CORCOIDUM-Public-note.md and the vault 99_Templates copy have drifted; "
            "update both to the same content.",
        )

    def test_template_keeps_the_public_review_checklist(self) -> None:
        text = VAULT_TEMPLATE.read_text(encoding="utf-8")
        self.assertIn("classification: S0_PUBLIC", text)
        self.assertIn("publish_state: draft", text)
        self.assertIn("## 검토 체크", text)
        self.assertTrue(text.endswith("\n"), "template must end with a newline")


if __name__ == "__main__":
    unittest.main()
