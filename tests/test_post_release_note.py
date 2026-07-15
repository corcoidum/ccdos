"""Tests for the release-note composer (pure logic only, no network or git)."""

import unittest

from automation.post_release_note import compose_message, enforce_limit, find_sensitive


class PostReleaseNoteTests(unittest.TestCase):
    def test_compose_message_formats_title_and_bullets(self) -> None:
        message = compose_message("릴리스", ["첫 변경", "  둘째 변경  ", "", "셋째 변경"])
        self.assertEqual(
            message,
            "**릴리스**\n• 첫 변경\n• 둘째 변경\n• 셋째 변경",
        )

    def test_compose_message_without_title(self) -> None:
        self.assertEqual(compose_message(None, ["변경"]), "• 변경")

    def test_find_sensitive_flags_token_and_phone(self) -> None:
        self.assertEqual(find_sensitive("api_key = abcdef1234567890"), "possible secret assignment")
        self.assertEqual(find_sensitive("연락처 010-1234-5678"), "Korean mobile phone number")

    def test_find_sensitive_passes_clean_release_note(self) -> None:
        self.assertIsNone(find_sensitive("**릴리스**\n• 공용 노트 모달 추가\n• 가치 태그 반영"))

    def test_enforce_limit_truncates_with_ellipsis(self) -> None:
        message = "x" * 2100
        trimmed = enforce_limit(message)
        self.assertEqual(len(trimmed), 2000)
        self.assertTrue(trimmed.endswith("…"))

    def test_enforce_limit_keeps_short_message(self) -> None:
        self.assertEqual(enforce_limit("짧은 노트"), "짧은 노트")


if __name__ == "__main__":
    unittest.main()
