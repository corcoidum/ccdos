"""Build a safe, static content index from approved public Markdown notes."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from automation.public_content import ParsedNote, glossary_notes, load_public_notes, record_notes
except ModuleNotFoundError:  # Direct execution: python automation/build_public_content.py
    from public_content import ParsedNote, glossary_notes, load_public_notes, record_notes

INDEX_VERSION = 2


def build_payload(source: Path) -> dict[str, object]:
    """Return only validated, explicitly approved Public Vault notes."""
    return build_payload_from_notes(load_public_notes(source))


def note_entry(note: ParsedNote) -> dict[str, object]:
    metadata = note.metadata
    return {
        "id": metadata["id"],
        "title": metadata["title"],
        "updated": metadata["updated"],
        "published_at": metadata.get("published_at"),
        "tags": metadata["tags"],
        "state": metadata["publish_state"],
        "body": note.body.strip(),
    }


def sort_by_recency(entries: list[dict[str, object]]) -> None:
    entries.sort(
        key=lambda note: (str(note.get("published_at") or note["updated"]), str(note["updated"]), str(note["id"])),
        reverse=True,
    )


def build_payload_from_notes(parsed_notes: list[ParsedNote]) -> dict[str, object]:
    """Split records from glossary terms so reading surfaces never mix the two."""
    notes = [note_entry(note) for note in record_notes(parsed_notes)]
    glossary = [
        {**note_entry(note), "aliases": sorted({str(alias) for alias in note.metadata["aliases"]})}
        for note in glossary_notes(parsed_notes)
    ]

    sort_by_recency(notes)
    sort_by_recency(glossary)
    return {"version": INDEX_VERSION, "notes": notes, "glossary": glossary}


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
    notes, glossary = payload["notes"], payload["glossary"]
    print(f"PASS: wrote {len(notes)} approved public note(s) and {len(glossary)} glossary term(s) to {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
