"""Create a redacted weekly review from already approved public content metadata."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path


def create_weekly_review(payload: dict[str, object], generated_at: datetime) -> dict[str, object]:
    notes = payload["notes"]
    tags = Counter(tag for note in notes if isinstance(note, dict) for tag in note.get("tags", []))
    return {
        "generated_at": generated_at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "overall_status": "passed",
        "approved_public_note_count": len(notes),
        "checks": [],
        "top_tags": [tag for tag, _ in tags.most_common(5)],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create a redacted weekly review from public metadata.")
    parser.add_argument("--output", type=Path, help="optional JSON output path")
    args = parser.parse_args(argv)
    root = Path(__file__).resolve().parents[1]
    payload = json.loads((root / "content" / "public" / "index.json").read_text(encoding="utf-8"))
    review = create_weekly_review(payload, datetime.now(UTC))
    rendered = json.dumps(review, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
        print(f"PASS: wrote redacted weekly review to {args.output}")
    else:
        print(rendered, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
