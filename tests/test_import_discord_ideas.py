"""Tests for the Discord ideas-channel importer (pure logic only, no network)."""

import json
import tempfile
import unittest
from pathlib import Path

from automation.import_discord_ideas import (
    build_note,
    ensure_inbox_outside_repo,
    load_state,
    save_state,
    select_importable,
    sensitive_label,
)


def message(message_id: str, content: str, bot: bool = False) -> dict[str, object]:
    return {
        "id": message_id,
        "content": content,
        "timestamp": "2026-07-14T05:00:00.000000+00:00",
        "author": {"bot": bot},
    }


class ImportDiscordIdeasTests(unittest.TestCase):
    def test_select_importable_filters_bots_and_empty_and_sorts_ascending(self) -> None:
        selected = select_importable(
            [
                message("30", "세 번째 아이디어"),
                message("10", "첫 아이디어"),
                message("20", "   "),
                message("40", "bot 메시지", bot=True),
                {"id": "not-a-number", "content": "잘못된 ID", "author": {}},
            ]
        )
        self.assertEqual([entry["id"] for entry in selected], ["10", "30"])

    def test_build_note_renders_frontmatter_and_body(self) -> None:
        filename, note, warning = build_note(message("123456789012", "Garden에 mercy 글감: 대기 시간 관찰"))
        self.assertEqual(filename, "idea-20260714-050000-789012.md")
        self.assertIsNone(warning)
        self.assertIn('message_id: "123456789012"', note)
        self.assertIn("source: discord-ideas", note)
        self.assertIn("captured_at: 2026-07-14T05:00:00Z", note)
        self.assertTrue(note.rstrip().endswith("Garden에 mercy 글감: 대기 시간 관찰"))
        self.assertNotIn("sensitive_warning", note)

    def test_build_note_flags_sensitive_content(self) -> None:
        _, note, warning = build_note(message("99", "연락처 010-1234-5678로 문의"))
        self.assertEqual(warning, "Korean mobile phone number")
        self.assertIn("sensitive_warning: Korean mobile phone number", note)

    def test_sensitive_label_passes_clean_content(self) -> None:
        self.assertIsNone(sensitive_label("부담을 줄이는 자동화 아이디어"))

    def test_state_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            inbox = Path(temp_dir)
            self.assertIsNone(load_state(inbox))
            save_state(inbox, "424242")
            self.assertEqual(load_state(inbox), "424242")
            payload = json.loads((inbox / ".discord-ideas-state.json").read_text(encoding="utf-8"))
            self.assertEqual(payload, {"last_message_id": "424242"})

    def test_rejects_inbox_inside_repository(self) -> None:
        repo_inbox = Path(__file__).resolve().parents[1] / "vaults" / "inbox"
        with self.assertRaisesRegex(ValueError, "outside this repository"):
            ensure_inbox_outside_repo(repo_inbox)

    def test_accepts_inbox_outside_repository(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            ensure_inbox_outside_repo(Path(temp_dir))


if __name__ == "__main__":
    unittest.main()
