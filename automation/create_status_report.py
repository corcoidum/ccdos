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
    # Merge both streams so a crash reported on stderr is never hidden by
    # earlier stdout; the last line of a traceback names the actual error.
    lines = [
        line
        for stream in (result.stdout, result.stderr)
        for line in stream.splitlines()
        if line.strip()
    ]
    return {
        "name": name,
        "status": "passed" if result.returncode == 0 else "failed",
        "summary": lines[-1] if lines else "no output",
    }


def count_approved_notes(root: Path) -> tuple[int, dict[str, str]]:
    """Read the approved note count as a check so a broken index cannot crash the report."""
    path = root / "content" / "public" / "index.json"
    try:
        notes = json.loads(path.read_text(encoding="utf-8"))["notes"]
        if not isinstance(notes, list):
            raise ValueError("notes must be a list")
    except (OSError, UnicodeError, ValueError, KeyError) as error:
        return 0, {"name": "public_content_index_readable", "status": "failed", "summary": f"cannot read {path.name}: {error}"}
    return len(notes), {"name": "public_content_index_readable", "status": "passed", "summary": f"{len(notes)} approved public note(s)"}


def create_report(
    root: Path,
    deployment_status: str | None = None,
    smoke_check_status: str | None = None,
) -> dict[str, object]:
    checks = [
        run_check("architecture", [sys.executable, "scripts/verify_phase0.py"], root),
        run_check("public_notes", [sys.executable, "automation/validate_notes.py", "vaults/CORCOIDUM-Public"], root),
        run_check("public_content_index", [sys.executable, "automation/build_public_content.py", "--check"], root),
        run_check("public_graph", [sys.executable, "automation/build_public_graph.py", "--check"], root),
    ]
    note_count, index_check = count_approved_notes(root)
    checks.append(index_check)
    if deployment_status is not None:
        checks.append(
            {
                "name": "deployment",
                "status": "passed" if deployment_status == "success" else "failed",
                "summary": f"deployment step outcome: {deployment_status}",
            }
        )
    if smoke_check_status is not None:
        checks.append(
            {
                "name": "post_deploy_smoke",
                "status": "passed" if smoke_check_status == "success" else "failed",
                "summary": f"post-deploy smoke step outcome: {smoke_check_status}",
            }
        )
    return {
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "overall_status": "passed" if all(check["status"] == "passed" for check in checks) else "failed",
        "approved_public_note_count": note_count,
        "checks": checks,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create a redacted CORCOIDUM OS status report.")
    parser.add_argument("--output", type=Path, help="optional JSON output path")
    parser.add_argument(
        "--deployment-status",
        choices=("success", "failure", "cancelled", "skipped"),
        help="optional GitHub Actions deployment step outcome",
    )
    parser.add_argument(
        "--smoke-check-status",
        choices=("success", "failure", "cancelled", "skipped"),
        help="optional GitHub Actions post-deploy smoke step outcome",
    )
    args = parser.parse_args(argv)
    root = Path(__file__).resolve().parents[1]
    report = create_report(
        root,
        deployment_status=args.deployment_status,
        smoke_check_status=args.smoke_check_status,
    )
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
