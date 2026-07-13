from __future__ import annotations

import unittest

from rag.search_public_wiki import search_public_wiki


class SearchPublicWikiTests(unittest.TestCase):
    def test_returns_only_matching_approved_sources_with_citations(self) -> None:
        payload = {
            "notes": [
                {
                    "id": "approved-automation",
                    "title": "안전한 automation 시작하기",
                    "updated": "2026-07-10T00:00:00Z",
                    "tags": ["automation"],
                    "state": "approved",
                    "body": "작은 automation은 검증 가능한 흐름부터 시작한다.",
                },
                {
                    "id": "draft-automation",
                    "title": "automation draft",
                    "updated": "2026-07-10T00:00:00Z",
                    "tags": ["automation"],
                    "state": "draft",
                    "body": "must not be searchable",
                },
            ]
        }
        result = search_public_wiki(payload, "automation")
        self.assertEqual([source["id"] for source in result["sources"]], ["approved-automation"])
        self.assertIn("근거", result["answer"])

    def test_matches_korean_token_with_attached_particle(self) -> None:
        payload = {
            "notes": [
                {
                    "id": "discord-403",
                    "title": "403은 항상 권한 문제가 아니다",
                    "updated": "2026-07-13T00:00:00Z",
                    "tags": ["debugging"],
                    "state": "published",
                    "body": "배포 단계가 계속 403으로 실패했다.",
                }
            ]
        }
        result = search_public_wiki(payload, "403")
        self.assertEqual([source["id"] for source in result["sources"]], ["discord-403"])

    def test_survives_note_missing_optional_fields(self) -> None:
        payload = {"notes": [{"state": "approved", "body": "automation evidence"}]}
        result = search_public_wiki(payload, "automation")
        self.assertEqual(len(result["sources"]), 1)
        self.assertEqual(result["sources"][0]["id"], "")
        self.assertIn("automation", result["sources"][0]["excerpt"])

    def test_returns_no_answer_without_approved_sources(self) -> None:
        result = search_public_wiki({"notes": []}, "clinic")
        self.assertEqual(result["sources"], [])
        self.assertIn("검색하지 않습니다", result["answer"])


if __name__ == "__main__":
    unittest.main()
