from __future__ import annotations

import unittest
from datetime import UTC, datetime

from automation.notify_discord import format_message, is_discord_webhook
from automation.weekly_review import create_weekly_review


class AutomationReportTests(unittest.TestCase):
    def test_formats_redacted_discord_message(self) -> None:
        report = {
            "generated_at": "2026-07-10T00:00:00Z",
            "overall_status": "passed",
            "approved_public_note_count": 2,
            "checks": [{"status": "passed"}, {"status": "passed"}],
        }
        message = format_message(report)
        self.assertIn("PASS", message)
        self.assertIn("2 passed, 0 failed", message)
        self.assertNotIn("body", message)

    def test_accepts_only_discord_webhook_hosts(self) -> None:
        self.assertTrue(is_discord_webhook("https://discord.com/api/webhooks/123/token"))
        self.assertFalse(is_discord_webhook("https://example.com/api/webhooks/123/token"))
        self.assertFalse(is_discord_webhook("http://discord.com/api/webhooks/123/token"))

    def test_weekly_review_uses_only_public_metadata(self) -> None:
        payload = {
            "notes": [
                {"tags": ["automation", "case-study"], "body": "do not expose"},
                {"tags": ["automation"], "body": "do not expose"},
            ]
        }
        review = create_weekly_review(payload, datetime(2026, 7, 10, tzinfo=UTC))
        self.assertEqual(review["approved_public_note_count"], 2)
        self.assertEqual(review["top_tags"], ["automation", "case-study"])
        self.assertNotIn("body", review)


if __name__ == "__main__":
    unittest.main()
