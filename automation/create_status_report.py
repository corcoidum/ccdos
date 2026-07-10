"""Create a redacted health report for the CORCOIDUM OS automation checks."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path


def run_check(name: str, command: list[str], root: Path) -> dict[str, str]:
    result = subprocess.run(command, cwd=root, capture_output=True, text=True, check=False)
    output = (result.stdout or result.stderr).strip().splitlines()
    return {
        "name": name,
        "status": "passed" if result.returncode == 0 else "failed",
        "summary": output[-1] if output else "no output",
    }


def create_report(root: Path) -> dict[str, object]:
    checks = [
        run_check("architecture", [sys.executable, "scripts/verify_phase0.py"], root),
        run_check("public_notes", [sys.executable, "automation/validate_notes.py", "vaults/CORCOIDUM-Public"], root),
        run_check("public_content_index", [sys.executable, "automation/build_public_content.py", "--check"], root),
    ]
    payload = json.loads((root / "content" / "public" / "index.json").read_text(encoding="utf-8"))
    return {
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "overall_status": "passed" if all(check["status"] == "passed" for check in checks) else "failed",
        "approved_public_note_count": len(payload["notes"]),
        "checks": checks,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create a redacted CORCOIDUM OS status report.")
    parser.add_argument("--output", type=Path, help="optional JSON output path")
    args = parser.parse_args(argv)
    root = Path(__file__).resolve().parents[1]
    report = create_report(root)
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
        print(f"PASS: wrote redacted status report to {args.output}")
    else:
        print(rendered, end="")
    return 0 if report["overall_status"] == "passed" else 1


if __name__ == "__main__":
    sys.exit(main())
