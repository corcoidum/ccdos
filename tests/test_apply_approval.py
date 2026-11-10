"""Approval evidence is written only after a person completes the review checklist."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from automation.apply_approval import (
    EVIDENCE_FIELDS,
    approve,
    governance_checklist,
    missing_checklist_items,
    revoke,
    rewrite_frontmatter,
)
from automation.validate_notes import parse_frontmatter, validate_note

ROOT = Path(__file__).resolve().parents[1]
GOVERNANCE_DOC = ROOT / "docs" / "governance" / "public-content-review.md"
PR_TEMPLATE = ROOT / ".github" / "pull_request_template.md"
NOW = "2026-11-10T06:00:00Z"
UPDATED = "2026-11-09T11:43:00Z"

CHECKLIST = ["사람을 알아볼 정보가 없다.", "비밀값이 없다."]
GOVERNANCE_TEXT = (
    "# 규칙\n\n## Privacy Review 체크리스트\n\n"
    + "".join(f"- [ ] {item}\n" for item in CHECKLIST)
    + "\n## 변경 이력 규칙\n\n- [ ] 다른 절의 항목\n"
)
CHECKED_BODY = "## 공개 노트 검토 체크\n\n" + "".join(f"- [x] {item}\n" for item in CHECKLIST)


def note_text(note_id: str, state: str = "draft", extra: str = "") -> str:
    return (
        "---\n"
        f"id: {note_id}\n"
        "title: 합성 노트\n"
        "created: 2026-11-09T11:43:00Z\n"
        f"updated: {UPDATED}\n"
        "classification: S0_PUBLIC\n"
        "visibility: public\n"
        f"publish_state: {state}\n"
        f"{extra}"
        "tags:\n"
        "  - trust\n"
        "---\n"
        "\n"
        "합성 본문입니다.\n"
    )


class ApprovalWorkspace(unittest.TestCase):
    def setUp(self) -> None:
        self._directory = tempfile.TemporaryDirectory()
        self.addCleanup(self._directory.cleanup)
        self.root = Path(self._directory.name)
        governance = self.root / "docs" / "governance" / "public-content-review.md"
        governance.parent.mkdir(parents=True)
        governance.write_text(GOVERNANCE_TEXT, encoding="utf-8")
        self.drafts = self.root / "vaults" / "CORCOIDUM-Public" / "00_Drafts"
        self.drafts.mkdir(parents=True)

    def write_note(self, note_id: str, state: str = "draft", extra: str = "") -> tuple[Path, str]:
        path = self.drafts / f"{note_id}.md"
        path.write_text(note_text(note_id, state, extra), encoding="utf-8")
        return path, f"vaults/CORCOIDUM-Public/00_Drafts/{note_id}.md"


class ChecklistTests(unittest.TestCase):
    def test_reads_only_the_privacy_review_section(self) -> None:
        self.assertEqual(governance_checklist(GOVERNANCE_TEXT), CHECKLIST)

    def test_unchecked_and_absent_items_are_missing(self) -> None:
        body = f"- [x] {CHECKLIST[0]}\n- [ ] {CHECKLIST[1]}\n"
        self.assertEqual(missing_checklist_items(CHECKLIST, body), [CHECKLIST[1]])
        self.assertEqual(missing_checklist_items(CHECKLIST, ""), CHECKLIST)

    def test_checked_items_tolerate_spacing_and_capital_x(self) -> None:
        body = f"  * [X]   {CHECKLIST[0]}  \n- [x] {CHECKLIST[1]}\n"
        self.assertEqual(missing_checklist_items(CHECKLIST, body), [])

    def test_pr_template_carries_every_governance_item_unchecked(self) -> None:
        required = governance_checklist(GOVERNANCE_DOC.read_text(encoding="utf-8"))
        self.assertTrue(required, "governance document lost its privacy review checklist")
        template = PR_TEMPLATE.read_text(encoding="utf-8")
        self.assertEqual(
            missing_checklist_items(required, template.replace("- [ ]", "- [x]")),
            [],
            "the pull request template and the governance checklist have drifted",
        )
        self.assertEqual(missing_checklist_items(required, template), required, "template items must start unchecked")


class RewriteFrontmatterTests(unittest.TestCase):
    def test_evidence_follows_publish_state_and_body_is_untouched(self) -> None:
        original = note_text("synthetic-note")
        rewritten = rewrite_frontmatter(original, "approved", {"approved_by": "owner", "approved_at": NOW})
        self.assertIn("publish_state: approved\napproved_by: owner\napproved_at: 2026-11-10T06:00:00Z\ntags:\n", rewritten)
        self.assertEqual(rewritten.split("---\n", 2)[2], original.split("---\n", 2)[2])

    def test_draft_round_trip_restores_the_original_text(self) -> None:
        original = note_text("synthetic-note")
        approved = rewrite_frontmatter(original, "approved", {"approved_by": "owner"})
        self.assertEqual(rewrite_frontmatter(approved, "draft", None), original)

    def test_commented_template_fields_are_kept(self) -> None:
        original = note_text("synthetic-note", extra="# approved_by: content-owner\n")
        self.assertIn("# approved_by: content-owner\n", rewrite_frontmatter(original, "approved", {"approved_by": "owner"}))


class ApproveTests(ApprovalWorkspace):
    def test_records_evidence_that_the_validator_accepts(self) -> None:
        path, changed = self.write_note("synthetic-note")
        note_ids, reasons = approve(self.root, [changed], "owner", "[draft] 합성 노트", CHECKED_BODY, NOW)
        self.assertEqual((note_ids, reasons), (["synthetic-note"], []))
        metadata, _ = parse_frontmatter(path.read_text(encoding="utf-8"))
        self.assertEqual(metadata["publish_state"], "approved")
        self.assertEqual(metadata["reviewed_revision"], UPDATED)
        self.assertEqual(metadata["privacy_review_result"], "passed")
        self.assertEqual((metadata["privacy_reviewed_by"], metadata["approved_by"]), ("owner", "owner"))
        self.assertEqual({metadata[field] for field in ("review_requested_at", "privacy_reviewed_at", "approved_at")}, {NOW})
        self.assertNotIn("published_at", metadata)
        self.assertEqual(validate_note(path), [])

    def test_refuses_when_a_checklist_item_is_unchecked(self) -> None:
        path, changed = self.write_note("synthetic-note")
        before = path.read_text(encoding="utf-8")
        body = f"- [x] {CHECKLIST[0]}\n- [ ] {CHECKLIST[1]}\n"
        note_ids, reasons = approve(self.root, [changed], "owner", "[draft] 합성 노트", body, NOW)
        self.assertEqual(note_ids, [])
        self.assertEqual(reasons, [f"checklist item not checked: {CHECKLIST[1]}"])
        self.assertEqual(path.read_text(encoding="utf-8"), before)

    def test_refuses_an_interview_pull_request(self) -> None:
        path, changed = self.write_note("synthetic-note")
        before = path.read_text(encoding="utf-8")
        _, reasons = approve(self.root, [changed], "owner", "[interview] 글감", CHECKED_BODY, NOW)
        self.assertTrue(any("interview" in reason for reason in reasons))
        self.assertEqual(path.read_text(encoding="utf-8"), before)

    def test_refuses_when_no_draft_note_changed(self) -> None:
        _, changed = self.write_note(
            "synthetic-note",
            "published",
            extra=(
                f"review_requested_at: {UPDATED}\nprivacy_reviewed_by: owner\nprivacy_reviewed_at: {UPDATED}\n"
                f"privacy_review_result: passed\nreviewed_revision: {UPDATED}\napproved_by: owner\n"
                f"approved_at: {UPDATED}\npublished_at: {UPDATED}\n"
            ),
        )
        note_ids, reasons = approve(self.root, [changed, "content/public/index.json"], "owner", "제목", CHECKED_BODY, NOW)
        self.assertEqual(note_ids, [])
        self.assertEqual(reasons, ["no draft or review note in this pull request to approve"])

    def test_ignores_templates_readmes_and_paths_outside_the_public_vault(self) -> None:
        templates = self.root / "vaults" / "CORCOIDUM-Public" / "99_Templates"
        templates.mkdir()
        (templates / "template.md").write_text(note_text("template-note"), encoding="utf-8")
        outside = self.root / "vaults" / "CORCOIDUM-Core"
        outside.mkdir()
        (outside / "core.md").write_text(note_text("core-note"), encoding="utf-8")
        changed = ["vaults/CORCOIDUM-Public/99_Templates/template.md", "vaults/CORCOIDUM-Core/core.md", "../escape.md"]
        note_ids, reasons = approve(self.root, changed, "owner", "제목", CHECKED_BODY, NOW)
        self.assertEqual(note_ids, [])
        self.assertEqual(reasons, ["no draft or review note in this pull request to approve"])
        self.assertIn("publish_state: draft", (templates / "template.md").read_text(encoding="utf-8"))

    def test_rolls_back_when_the_validator_rejects_the_note(self) -> None:
        path, changed = self.write_note("synthetic-note")
        path.write_text(path.read_text(encoding="utf-8") + "연락처 010-1234-5678\n", encoding="utf-8")
        before = path.read_text(encoding="utf-8")
        note_ids, reasons = approve(self.root, [changed], "owner", "제목", CHECKED_BODY, NOW)
        self.assertEqual(note_ids, [])
        self.assertTrue(any("possible sensitive data found" in reason for reason in reasons))
        self.assertEqual(path.read_text(encoding="utf-8"), before)

    def test_refuses_an_invalid_approver(self) -> None:
        _, changed = self.write_note("synthetic-note")
        _, reasons = approve(self.root, [changed], "not a login", "제목", CHECKED_BODY, NOW)
        self.assertIn("approver is not a valid account name", reasons)


class RevokeTests(ApprovalWorkspace):
    def test_approved_note_returns_to_its_original_draft(self) -> None:
        path, changed = self.write_note("synthetic-note")
        before = path.read_text(encoding="utf-8")
        approve(self.root, [changed], "owner", "제목", CHECKED_BODY, NOW)
        note_ids, reasons = revoke(self.root, [changed])
        self.assertEqual((note_ids, reasons), (["synthetic-note"], []))
        self.assertEqual(path.read_text(encoding="utf-8"), before)
        self.assertFalse(any(f"{field}:" in path.read_text(encoding="utf-8") for field in EVIDENCE_FIELDS))

    def test_draft_and_published_notes_are_left_alone(self) -> None:
        draft_path, draft_changed = self.write_note("draft-note")
        before = draft_path.read_text(encoding="utf-8")
        self.assertEqual(revoke(self.root, [draft_changed]), ([], []))
        self.assertEqual(draft_path.read_text(encoding="utf-8"), before)


if __name__ == "__main__":
    unittest.main()
