"""Build a safe, static content index from approved public Markdown notes."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from automation.validate_notes import collect_duplicate_id_issues, markdown_files, parse_frontmatter, validate_note
except ModuleNotFoundError:  # Direct execution: python automation/build_public_content.py
    from validate_notes import collect_duplicate_id_issues, markdown_files, parse_frontmatter, validate_note

PUBLISHABLE_STATES = {"approved", "published"}


def build_payload(source: Path) -> dict[str, object]:
    """Return only validated, explicitly approved Public Vault notes."""
    files = markdown_files([source])
    if not files:
        raise ValueError(f"no Markdown notes found in {source}")

    issues = [issue for path in files for issue in validate_note(path)]
    # 단독 build 실행에서도 인용 ID의 유일성을 보장한다.
    issues.extend(collect_duplicate_id_issues(files))
    if issues:
        messages = "\n".join(f"{issue.path}: {issue.message}" for issue in issues)
        raise ValueError(f"public content validation failed:\n{messages}")

    notes: list[dict[str, object]] = []
    for path in files:
        metadata, body = parse_frontmatter(path.read_text(encoding="utf-8"))
        if metadata["publish_state"] not in PUBLISHABLE_STATES:
            continue
        notes.append(
            {
                "id": metadata["id"],
                "title": metadata["title"],
                "updated": metadata["updated"],
                "published_at": metadata.get("published_at"),
                "tags": metadata["tags"],
                "state": metadata["publish_state"],
                "body": body.strip(),
            }
        )

    notes.sort(
        key=lambda note: (str(note.get("published_at") or note["updated"]), str(note["updated"]), str(note["id"])),
        reverse=True,
    )
    return {"version": 1, "notes": notes}


def render_payload(payload: dict[str, object]) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def output_matches(output: Path, rendered: str) -> bool:
    return output.is_file() and output.read_text(encoding="utf-8") == rendered


def main(argv: list[str] | None = None) -> int:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Build the approved CORCOIDUM-Public content index.")
    parser.add_argument("--source", type=Path, default=root / "vaults" / "CORCOIDUM-Public")
    parser.add_argument("--output", type=Path, default=root / "content" / "public" / "index.json")
    parser.add_argument("--check", action="store_true", help="fail when the generated index is missing or stale")
    args = parser.parse_args(argv)

    try:
        payload = build_payload(args.source)
        rendered = render_payload(payload)
    except (OSError, UnicodeError, ValueError) as error:
        print(f"FAIL: {error}")
        return 1

    if args.check:
        if output_matches(args.output, rendered):
            print(f"PASS: approved public content index is current: {args.output}")
            return 0
        print(f"FAIL: generated public content index is missing or stale: {args.output}")
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(rendered, encoding="utf-8")
    count = len(payload["notes"])
    print(f"PASS: wrote {count} approved public note(s) to {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
