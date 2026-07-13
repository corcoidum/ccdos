"""Create a redacted weekly review: the full status checks plus public tag trends."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

try:
    from create_status_report import create_report  # run as a script: python automation/weekly_review.py
except ImportError:  # imported as automation.weekly_review (tests, tooling)
    from automation.create_status_report import create_report


def create_weekly_review(report: dict[str, object], payload: dict[str, object]) -> dict[str, object]:
    """Extend a status report with tag trends from already approved public metadata."""
    notes = payload["notes"]
    tags = Counter(tag for note in notes if isinstance(note, dict) for tag in note.get("tags", []))
    return {**report, "top_tags": [tag for tag, _ in tags.most_common(5)]}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create a redacted weekly review from public metadata.")
    parser.add_argument("--output", type=Path, help="optional JSON output path")
    args = parser.parse_args(argv)
    root = Path(__file__).resolve().parents[1]
    index_path = root / "content" / "public" / "index.json"
    try:
        payload = json.loads(index_path.read_text(encoding="utf-8"))
        if not isinstance(payload.get("notes"), list):
            raise ValueError("notes must be a list")
    except (OSError, UnicodeError, ValueError) as error:
        print(f"FAIL: cannot read approved public content index: {error}")
        return 1
    review = create_weekly_review(create_report(root), payload)
    rendered = json.dumps(review, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
        print(f"PASS: wrote redacted weekly review to {args.output}")
    else:
        print(rendered, end="")
    return 0 if review["overall_status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
