"""Record or revoke approval evidence on public notes after a person's explicit decision.

The person decides; this script only writes down what they decided. It refuses to record
anything unless every privacy review checklist item from the governance document is ticked
in the pull request body, and it never judges whether a note is safe to publish.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from datetime import UTC, datetime
from pathlib import Path

try:
    from validate_notes import (  # run as a script: python automation/apply_approval.py
        format_issue,
        load_and_validate_notes,
        markdown_files,
        parse_frontmatter,
    )
except ImportError:  # imported as automation.apply_approval (tests, tooling)
    from automation.validate_notes import format_issue, load_and_validate_notes, markdown_files, parse_frontmatter

PUBLIC_VAULT = Path("vaults") / "CORCOIDUM-Public"
TEMPLATE_DIR = "99_Templates"
GOVERNANCE_DOC = Path("docs") / "governance" / "public-content-review.md"
CHECKLIST_HEADING = "## Privacy Review 체크리스트"
# Written in this order directly under publish_state, matching the notes already published.
EVIDENCE_FIELDS = (
    "review_requested_at",
    "privacy_reviewed_by",
    "privacy_reviewed_at",
    "privacy_review_result",
    "reviewed_revision",
    "approved_by",
    "approved_at",
)
APPROVABLE_STATES = {"draft", "review"}
INTERVIEW_PREFIX = "[interview]"
APPROVER_PATTERN = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")
UNCHECKED_ITEM = re.compile(r"^\s*[-*]\s*\[ \]\s*(.+?)\s*$")
CHECKED_ITEM = re.compile(r"^\s*[-*]\s*\[[xX]\]\s*(.+?)\s*$")


def normalize(item: str) -> str:
    return " ".join(item.split())


def governance_checklist(document: str) -> list[str]:
    """Return the checklist items the governance document requires, in order."""
    items: list[str] = []
    in_section = False
    for line in document.splitlines():
        if line.startswith("## "):
            in_section = line.strip() == CHECKLIST_HEADING
            continue
        if in_section and (match := UNCHECKED_ITEM.match(line)):
            items.append(normalize(match.group(1)))
    return items


def checked_items(pr_body: str) -> set[str]:
    return {normalize(match.group(1)) for line in pr_body.splitlines() if (match := CHECKED_ITEM.match(line))}


def missing_checklist_items(required: list[str], pr_body: str) -> list[str]:
    checked = checked_items(pr_body)
    return [item for item in required if item not in checked]


def rewrite_frontmatter(text: str, state: str, evidence: dict[str, str] | None) -> str:
    """Set publish_state and replace the evidence fields, leaving every other line untouched."""
    lines = text.split("\n")
    if not lines or lines[0].strip() != "---":
        raise ValueError("frontmatter must start with ---")
    try:
        end = next(index for index, line in enumerate(lines[1:], 1) if line.strip() == "---")
    except StopIteration as error:
        raise ValueError("frontmatter closing --- is missing") from error

    rewritten: list[str] = []
    state_written = False
    for line in lines[1:end]:
        is_field = bool(line) and not line[0].isspace() and not line.startswith("#") and ":" in line
        key = line.split(":", 1)[0].strip() if is_field else None
        if key in EVIDENCE_FIELDS or key == "published_at":
            continue
        if key == "publish_state":
            rewritten.append(f"publish_state: {state}")
            rewritten.extend(f"{field}: {value}" for field, value in (evidence or {}).items())
            state_written = True
            continue
        rewritten.append(line)
    if not state_written:
        raise ValueError("publish_state is missing")
    return "\n".join([lines[0], *rewritten, *lines[end:]])


def approval_evidence(approver: str, now: str, updated: str) -> dict[str, str]:
    values = {
        "review_requested_at": now,
        "privacy_reviewed_by": approver,
        "privacy_reviewed_at": now,
        "privacy_review_result": "passed",
        "reviewed_revision": updated,
        "approved_by": approver,
        "approved_at": now,
    }
    return {field: values[field] for field in EVIDENCE_FIELDS}


def note_targets(root: Path, changed_files: list[str]) -> list[Path]:
    """Keep the changed public notes that still exist; templates and READMEs are never notes."""
    targets: list[Path] = []
    for name in changed_files:
        relative = Path(name.strip())
        if not name.strip() or relative.is_absolute() or ".." in relative.parts:
            continue
        if relative.parts[: len(PUBLIC_VAULT.parts)] != PUBLIC_VAULT.parts:
            continue
        if relative.suffix.lower() != ".md" or relative.name.lower() == "readme.md" or TEMPLATE_DIR in relative.parts:
            continue
        path = root / relative
        if path.is_file() and not path.is_symlink():
            targets.append(path)
    return sorted(set(targets))


def read_states(targets: list[Path]) -> tuple[dict[Path, tuple[str, dict[str, object]]], list[str]]:
    notes: dict[Path, tuple[str, dict[str, object]]] = {}
    problems: list[str] = []
    for path in targets:
        try:
            text = path.read_text(encoding="utf-8")
            metadata, _ = parse_frontmatter(text)
        except (OSError, UnicodeError, ValueError) as error:
            problems.append(f"{path.name}: {error}")
            continue
        notes[path] = (text, metadata)
    return notes, problems


def write_and_validate(root: Path, changes: dict[Path, str], originals: dict[Path, str]) -> list[str]:
    """Write the changes, validate the whole public vault, and roll back if anything fails."""
    for path, text in changes.items():
        path.write_text(text, encoding="utf-8", newline="")
    _, issues = load_and_validate_notes(markdown_files([root / PUBLIC_VAULT]))
    if issues:
        for path in changes:
            path.write_text(originals[path], encoding="utf-8", newline="")
    return [format_issue(issue) for issue in issues]


def approve(root: Path, changed_files: list[str], approver: str, pr_title: str, pr_body: str, now: str) -> tuple[list[str], list[str]]:
    """Return (approved note ids, refusal reasons). Nothing is written when there is a reason."""
    reasons: list[str] = []
    if not APPROVER_PATTERN.fullmatch(approver):
        reasons.append("approver is not a valid account name")
    if pr_title.strip().lower().startswith(INTERVIEW_PREFIX):
        reasons.append("this pull request is still an interview; write the note before approving it")

    try:
        required = governance_checklist((root / GOVERNANCE_DOC).read_text(encoding="utf-8"))
    except (OSError, UnicodeError):
        required = []
    if not required:
        reasons.append(f"cannot read the privacy review checklist from {GOVERNANCE_DOC.as_posix()}")
    reasons.extend(f"checklist item not checked: {item}" for item in missing_checklist_items(required, pr_body))

    notes, problems = read_states(note_targets(root, changed_files))
    reasons.extend(problems)
    candidates = {path: value for path, value in notes.items() if value[1].get("publish_state") in APPROVABLE_STATES}
    if not candidates and not problems:
        reasons.append("no draft or review note in this pull request to approve")
    if reasons:
        return [], reasons

    changes: dict[Path, str] = {}
    for path, (text, metadata) in candidates.items():
        evidence = approval_evidence(approver, now, str(metadata.get("updated", "")))
        changes[path] = rewrite_frontmatter(text, "approved", evidence)
    issues = write_and_validate(root, changes, {path: text for path, (text, _) in candidates.items()})
    if issues:
        return [], issues
    return sorted(str(metadata.get("id")) for _, metadata in candidates.values()), []


def revoke(root: Path, changed_files: list[str]) -> tuple[list[str], list[str]]:
    """Return approved-but-unpublished notes to draft so stale evidence cannot be reused."""
    notes, problems = read_states(note_targets(root, changed_files))
    if problems:
        return [], problems
    candidates = {path: value for path, value in notes.items() if value[1].get("publish_state") == "approved"}
    if not candidates:
        return [], []
    changes = {path: rewrite_frontmatter(text, "draft", None) for path, (text, _) in candidates.items()}
    issues = write_and_validate(root, changes, {path: text for path, (text, _) in candidates.items()})
    if issues:
        return [], issues
    return sorted(str(metadata.get("id")) for _, metadata in candidates.values()), []


def utc_now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Record or revoke approval evidence on changed public notes.")
    parser.add_argument("action", choices=("approve", "revoke"))
    parser.add_argument("--changed-files", type=Path, required=True, help="file listing changed paths, one per line")
    parser.add_argument("--approver", default="", help="account that applied the approve label")
    parser.add_argument("--pr-title-env", default="PR_TITLE", help="environment variable holding the pull request title")
    parser.add_argument("--pr-body-env", default="PR_BODY", help="environment variable holding the pull request body")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args(argv)

    try:
        changed_files = args.changed_files.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError) as error:
        print(f"FAIL: cannot read changed file list: {error}")
        return 1

    if args.action == "approve":
        title, body = os.environ.get(args.pr_title_env, ""), os.environ.get(args.pr_body_env, "")
        note_ids, reasons = approve(args.root, changed_files, args.approver, title, body, utc_now())
        verb = "recorded approval evidence for"
    else:
        note_ids, reasons = revoke(args.root, changed_files)
        verb = "returned to draft"

    if reasons:
        for reason in reasons:
            print(f"FAIL: {reason}")
        return 1
    if not note_ids:
        print("PASS: no approved note needed a change.")
        return 0
    for note_id in note_ids:
        print(f"PASS: {verb} {note_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
