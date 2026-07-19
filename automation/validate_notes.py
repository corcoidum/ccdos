"""Validate Phase 1 Obsidian metadata and obvious sensitive patterns."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

REQUIRED_FIELDS = {"id", "title", "created", "updated", "classification", "visibility", "publish_state", "tags"}
CLASSIFICATIONS = {"S0_PUBLIC", "S1_PRIVATE", "S2_INTERNAL_DEIDENTIFIED"}
VISIBILITIES = {"local", "private", "public"}
PUBLISH_STATES = {"draft", "review", "approved", "published", "archived"}
PUBLISHABLE_STATES = {"approved", "published"}
RELATION_TYPES = {"related_to", "builds_on", "supports", "demonstrates", "implemented_by", "uses"}
ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
ISO_UTC_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
PUBLIC_REVIEW_FIELDS = {"review_requested_at", "privacy_reviewed_by", "privacy_reviewed_at", "privacy_review_result", "reviewed_revision"}

# High-confidence patterns only: matches block the file; uncertain cases need human review.
SENSITIVE_PATTERNS = {
    "Korean resident registration number": re.compile(r"(?<!\d)\d{6}-?[1-4]\d{6}(?!\d)"),
    "Korean mobile phone number": re.compile(r"(?<!\d)01[016789]-?\d{3,4}-?\d{4}(?!\d)"),
    "email address": re.compile(r"\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b"),
    "possible secret assignment": re.compile(r"(?i)\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*[^\s<]{8,}"),
}
VAULT_RULES = {
    "ClinicOps-Local.example": ("S2_INTERNAL_DEIDENTIFIED", "local"),
    "CORCOIDUM-Core": ("S1_PRIVATE", "private"),
    "CORCOIDUM-Public": ("S0_PUBLIC", "public"),
}


@dataclass(frozen=True)
class ValidationIssue:
    path: Path
    message: str
    include_path: bool = True


@dataclass(frozen=True)
class ParsedNote:
    path: Path
    metadata: dict[str, object]
    body: str
    text: str


def parse_inline_list(key: str, value: str) -> list[str]:
    items = [item.strip().strip("\"'") for item in value[1:-1].split(",")] if value[1:-1].strip() else []
    if any(not item for item in items):
        raise ValueError(f"empty list item for {key}")
    return items


def parse_relation_list(lines: list[str], index: int, end_index: int) -> tuple[list[dict[str, str]], int]:
    """Parse the documented one-level YAML list of relation objects."""
    relations: list[dict[str, str]] = []
    while index < end_index and lines[index].startswith("  - "):
        first_field = lines[index][4:].strip()
        if not first_field or ":" not in first_field:
            raise ValueError("relations items must be objects with target and type")

        relation: dict[str, str] = {}
        field, raw_value = first_field.split(":", 1)
        field = field.strip()
        if not field:
            raise ValueError("relations item has an invalid field")
        relation[field] = raw_value.strip().strip("\"'")
        index += 1

        while index < end_index and lines[index].startswith("    "):
            nested_line = lines[index].strip()
            if not nested_line or nested_line.startswith("#"):
                index += 1
                continue
            if ":" not in nested_line:
                raise ValueError(f"unsupported relations line: {lines[index]}")
            field, raw_value = nested_line.split(":", 1)
            field = field.strip()
            if not field or field in relation:
                raise ValueError(f"invalid or duplicate relations field: {field}")
            relation[field] = raw_value.strip().strip("\"'")
            index += 1
        relations.append(relation)
    return relations, index


def parse_frontmatter(text: str) -> tuple[dict[str, object], str]:
    """Parse scalars, simple lists, and the documented relation objects."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError("frontmatter must start with ---")
    try:
        end_index = next(index for index, line in enumerate(lines[1:], 1) if line.strip() == "---")
    except StopIteration as error:
        raise ValueError("frontmatter closing --- is missing") from error

    metadata: dict[str, object] = {}
    index = 1
    while index < end_index:
        line = lines[index]
        if not line.strip() or line.lstrip().startswith("#"):
            index += 1
            continue
        if line.startswith("  - ") or ":" not in line:
            raise ValueError(f"unsupported frontmatter line: {line}")
        key, raw_value = line.split(":", 1)
        key, value = key.strip(), raw_value.strip()
        if not key or key in metadata:
            raise ValueError(f"invalid or duplicate frontmatter field: {key}")
        if value:
            if value.startswith("[") and value.endswith("]"):
                metadata[key] = parse_inline_list(key, value)
            else:
                metadata[key] = value.strip("\"'")
            index += 1
            continue
        index += 1
        if key == "relations":
            relations, index = parse_relation_list(lines, index, end_index)
            if not relations:
                raise ValueError("frontmatter field relations has no value")
            metadata[key] = relations
            continue

        items: list[str] = []
        while index < end_index and lines[index].startswith("  - "):
            item = lines[index][4:].strip()
            if not item:
                raise ValueError(f"empty list item for {key}")
            items.append(item.strip("\"'"))
            index += 1
        if not items:
            raise ValueError(f"frontmatter field {key} has no value")
        metadata[key] = items
    return metadata, "\n".join(lines[end_index + 1 :])


def is_utc_timestamp(value: object) -> bool:
    if not isinstance(value, str) or not ISO_UTC_PATTERN.fullmatch(value):
        return False
    try:
        datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return False
    return True


def parse_utc_timestamp(value: object) -> datetime | None:
    if not is_utc_timestamp(value):
        return None
    return datetime.strptime(str(value), "%Y-%m-%dT%H:%M:%SZ")


def vault_name(path: Path) -> str | None:
    return next((part for part in path.parts if part in VAULT_RULES), None)


def relation_issue(note: ParsedNote, index: int, target: object, rule: str) -> ValidationIssue:
    note_id = note.metadata.get("id")
    safe_note_id = note_id if isinstance(note_id, str) and note_id else "<unknown>"
    if target is None:
        safe_target = "<missing>"
    elif not isinstance(target, str) or not target.strip():
        safe_target = "<empty>"
    else:
        safe_target = target.strip()
    return ValidationIssue(
        note.path,
        f"note id={safe_note_id} relation[{index}] target={safe_target} rule={rule}",
        include_path=False,
    )


def validate_relations(note: ParsedNote) -> list[ValidationIssue]:
    relations = note.metadata.get("relations")
    if relations is None:
        return []
    if not isinstance(relations, list):
        return [relation_issue(note, 0, None, "relations_must_be_a_list")]

    issues: list[ValidationIssue] = []
    seen: set[tuple[str, str]] = set()
    source_id = note.metadata.get("id")
    for index, relation in enumerate(relations):
        if not isinstance(relation, dict):
            issues.append(relation_issue(note, index, None, "relation_must_be_an_object"))
            continue
        target = relation.get("target")
        relation_type = relation.get("type")
        if "target" not in relation:
            issues.append(relation_issue(note, index, None, "target_is_required"))
        elif not isinstance(target, str) or not target.strip():
            issues.append(relation_issue(note, index, target, "target_must_not_be_empty"))
        elif not ID_PATTERN.fullmatch(target):
            issues.append(relation_issue(note, index, target, "target_id_must_be_lowercase_kebab_case"))
        if "type" not in relation:
            issues.append(relation_issue(note, index, target, "type_is_required"))
        elif relation_type not in RELATION_TYPES:
            issues.append(relation_issue(note, index, target, f"relation_type_not_allowed:{relation_type}"))
        extra_fields = sorted(set(relation) - {"target", "type"})
        if extra_fields:
            issues.append(relation_issue(note, index, target, "unexpected_fields:" + ",".join(extra_fields)))
        if isinstance(target, str) and target and target == source_id:
            issues.append(relation_issue(note, index, target, "self_relation_not_allowed"))
        if isinstance(target, str) and target and isinstance(relation_type, str) and relation_type in RELATION_TYPES:
            edge_key = (target, relation_type)
            if edge_key in seen:
                issues.append(relation_issue(note, index, target, "duplicate_source_target_type"))
            seen.add(edge_key)
    return issues


def validate_parsed_note(note: ParsedNote) -> list[ValidationIssue]:
    path, metadata, body, text = note.path, note.metadata, note.body, note.text

    issues: list[ValidationIssue] = []
    missing = REQUIRED_FIELDS - metadata.keys()
    if missing:
        return [ValidationIssue(path, "missing required fields: " + ", ".join(sorted(missing)))]
    if not isinstance(metadata["id"], str) or not ID_PATTERN.fullmatch(metadata["id"]):
        issues.append(ValidationIssue(path, "id must be lowercase kebab-case"))
    if not isinstance(metadata["title"], str) or not metadata["title"].strip():
        issues.append(ValidationIssue(path, "title must not be empty"))
    for field in ("created", "updated"):
        if not is_utc_timestamp(metadata[field]):
            issues.append(ValidationIssue(path, f"{field} must be an ISO 8601 UTC timestamp ending in Z"))
    if metadata["classification"] not in CLASSIFICATIONS:
        issues.append(ValidationIssue(path, "classification is not allowed"))
    if metadata["visibility"] not in VISIBILITIES:
        issues.append(ValidationIssue(path, "visibility is not allowed"))
    if metadata["publish_state"] not in PUBLISH_STATES:
        issues.append(ValidationIssue(path, "publish_state is not allowed"))
    if not isinstance(metadata["tags"], list) or not metadata["tags"]:
        issues.append(ValidationIssue(path, "tags must be a non-empty YAML list"))

    state = metadata["publish_state"]
    name = vault_name(path)
    is_public_note = name == "CORCOIDUM-Public"

    if is_public_note and state in {"review", "approved", "published"}:
        missing_review_fields = sorted(field for field in PUBLIC_REVIEW_FIELDS if not metadata.get(field))
        if missing_review_fields:
            issues.append(
                ValidationIssue(path, "public review note missing fields: " + ", ".join(missing_review_fields))
            )
        if metadata.get("review_requested_at") and not is_utc_timestamp(metadata["review_requested_at"]):
            issues.append(ValidationIssue(path, "review_requested_at must be an ISO 8601 UTC timestamp ending in Z"))
        if metadata.get("privacy_reviewed_at") and not is_utc_timestamp(metadata["privacy_reviewed_at"]):
            issues.append(ValidationIssue(path, "privacy_reviewed_at must be an ISO 8601 UTC timestamp ending in Z"))
        if metadata.get("privacy_review_result") != "passed":
            issues.append(ValidationIssue(path, "public review note requires privacy_review_result: passed"))
        if metadata.get("reviewed_revision") != metadata.get("updated"):
            issues.append(ValidationIssue(path, "reviewed_revision must equal updated; changed content must return to review"))
        requested_at = parse_utc_timestamp(metadata.get("review_requested_at"))
        reviewed_at = parse_utc_timestamp(metadata.get("privacy_reviewed_at"))
        if requested_at and reviewed_at and reviewed_at < requested_at:
            issues.append(ValidationIssue(path, "privacy_reviewed_at must not be earlier than review_requested_at"))

    if state in {"approved", "published"}:
        for field in ("approved_by", "approved_at"):
            if not metadata.get(field):
                issues.append(ValidationIssue(path, f"{state} note requires {field}"))
        if metadata.get("approved_at") and not is_utc_timestamp(metadata["approved_at"]):
            issues.append(ValidationIssue(path, "approved_at must be an ISO 8601 UTC timestamp ending in Z"))
        reviewed_at = parse_utc_timestamp(metadata.get("privacy_reviewed_at"))
        approved_at = parse_utc_timestamp(metadata.get("approved_at"))
        if reviewed_at and approved_at and approved_at < reviewed_at:
            issues.append(ValidationIssue(path, "approved_at must not be earlier than privacy_reviewed_at"))
    if state == "published":
        if not metadata.get("published_at"):
            issues.append(ValidationIssue(path, "published note requires published_at"))
        elif not is_utc_timestamp(metadata["published_at"]):
            issues.append(ValidationIssue(path, "published_at must be an ISO 8601 UTC timestamp ending in Z"))
        else:
            published_at = parse_utc_timestamp(metadata["published_at"])
            approved_at = parse_utc_timestamp(metadata.get("approved_at"))
            if published_at and approved_at and published_at < approved_at:
                issues.append(ValidationIssue(path, "published_at must not be earlier than approved_at"))

    if name:
        expected_classification, expected_visibility = VAULT_RULES[name]
        if metadata["classification"] != expected_classification:
            issues.append(ValidationIssue(path, f"{name} requires {expected_classification}"))
        if metadata["visibility"] != expected_visibility:
            issues.append(ValidationIssue(path, f"{name} requires visibility: {expected_visibility}"))
        if name != "CORCOIDUM-Public" and state in {"approved", "published"}:
            issues.append(ValidationIssue(path, f"{name} cannot contain {state} notes"))

    for label, pattern in SENSITIVE_PATTERNS.items():
        if pattern.search(text):
            issues.append(ValidationIssue(path, f"possible sensitive data found: {label}"))
    if metadata.get("classification") == "S3_RESTRICTED" or "S3_RESTRICTED" in body:
        issues.append(ValidationIssue(path, "S3_RESTRICTED material must not be stored in this repository"))
    issues.extend(validate_relations(note))
    return issues


def read_note(path: Path) -> ParsedNote:
    text = path.read_text(encoding="utf-8")
    metadata, body = parse_frontmatter(text)
    return ParsedNote(path=path, metadata=metadata, body=body, text=text)


def validate_note(path: Path) -> list[ValidationIssue]:
    try:
        note = read_note(path)
    except (OSError, UnicodeError, ValueError) as error:
        return [ValidationIssue(path, str(error))]
    return validate_parsed_note(note)


def collect_duplicate_id_issues_from_notes(notes: list[ParsedNote]) -> list[ValidationIssue]:
    paths_by_id: dict[str, list[Path]] = {}
    for note in notes:
        note_id = note.metadata.get("id")
        if isinstance(note_id, str) and note_id:
            paths_by_id.setdefault(note_id, []).append(note.path)
    return [
        ValidationIssue(paths[0], f"duplicate note id '{note_id}' also used by: " + ", ".join(str(path) for path in paths[1:]))
        for note_id, paths in sorted(paths_by_id.items())
        if len(paths) > 1
    ]


def collect_duplicate_id_issues(files: list[Path]) -> list[ValidationIssue]:
    """Reject reuse of a note id across files; ids must be unique to stay citable."""
    notes: list[ParsedNote] = []
    for path in files:
        try:
            notes.append(read_note(path))
        except (OSError, UnicodeError, ValueError):
            continue  # unreadable files are already reported by validate_note
    return collect_duplicate_id_issues_from_notes(notes)


def collect_relation_target_issues(notes: list[ParsedNote]) -> list[ValidationIssue]:
    """Resolve public relations only against approved notes in the Public Vault."""
    all_notes_by_id = {
        note.metadata["id"]: note
        for note in notes
        if isinstance(note.metadata.get("id"), str) and note.metadata["id"]
    }
    public_notes_by_id = {
        note_id: note for note_id, note in all_notes_by_id.items() if vault_name(note.path) == "CORCOIDUM-Public"
    }
    issues: list[ValidationIssue] = []
    for note in public_notes_by_id.values():
        if note.metadata.get("publish_state") not in PUBLISHABLE_STATES:
            continue
        relations = note.metadata.get("relations", [])
        if not isinstance(relations, list):
            continue
        for index, relation in enumerate(relations):
            if not isinstance(relation, dict):
                continue
            target = relation.get("target")
            if not isinstance(target, str) or not ID_PATTERN.fullmatch(target):
                continue
            target_note = public_notes_by_id.get(target)
            if target_note is None:
                rule = "private_or_local_target_not_allowed" if target in all_notes_by_id else "target_not_found"
                issues.append(relation_issue(note, index, target, rule))
            elif target_note.metadata.get("publish_state") not in PUBLISHABLE_STATES:
                issues.append(relation_issue(note, index, target, "target_must_be_approved_or_published"))
    return issues


def load_and_validate_notes(files: list[Path]) -> tuple[list[ParsedNote], list[ValidationIssue]]:
    """Read every note once, then run file-level and cross-note validation."""
    notes: list[ParsedNote] = []
    issues: list[ValidationIssue] = []
    for path in files:
        try:
            note = read_note(path)
        except (OSError, UnicodeError, ValueError) as error:
            issues.append(ValidationIssue(path, str(error)))
            continue
        notes.append(note)
        issues.extend(validate_parsed_note(note))
    issues.extend(collect_duplicate_id_issues_from_notes(notes))
    issues.extend(collect_relation_target_issues(notes))
    return notes, issues


def format_issue(issue: ValidationIssue) -> str:
    return f"{issue.path}: {issue.message}" if issue.include_path else issue.message


def markdown_files(targets: list[Path]) -> list[Path]:
    files: list[Path] = []
    for target in targets:
        if target.is_file() and target.suffix.lower() == ".md" and target.name.lower() != "readme.md":
            files.append(target)
        elif target.is_dir():
            files.extend(path for path in target.rglob("*.md") if path.name.lower() != "readme.md")
    return sorted(set(files))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate Phase 1 Obsidian example notes.")
    parser.add_argument("paths", nargs="*", type=Path, help="Markdown files or directories to validate")
    args = parser.parse_args(argv)
    root = Path(__file__).resolve().parents[1]
    files = markdown_files(args.paths or [root / "vaults"])
    if not files:
        print("FAIL: no Markdown notes found")
        return 1
    _, issues = load_and_validate_notes(files)
    if issues:
        for issue in issues:
            print(f"FAIL: {format_issue(issue)}")
        return 1
    print(f"PASS: validated {len(files)} Markdown note(s) with metadata and privacy rules.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
