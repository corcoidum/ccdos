"""Compose a short "done" note and optionally post it to a Discord #DONE channel.

Reuses the redacted Discord sender (with the 403-avoiding User-Agent) from
notify_discord.py. Discord is an external service, so the message is checked
against the same high-confidence sensitive patterns before sending, and posting
is gated behind --send. Content comes from a one-line --message, a --summary-file,
or an auto-draft of git commit subjects for review.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

try:
    from automation.notify_discord import is_discord_webhook, send_message
    from automation.validate_notes import SENSITIVE_PATTERNS
except ModuleNotFoundError:  # Direct execution: python automation/post_done_note.py
    from notify_discord import is_discord_webhook, send_message
    from validate_notes import SENSITIVE_PATTERNS

WEBHOOK_ENV = "DISCORD_DONE_WEBHOOK_URL"
DISCORD_CONTENT_LIMIT = 2000


def compose_message(title: str | None, lines: list[str]) -> str:
    body = "\n".join(f"• {line.strip()}" for line in lines if line.strip())
    header = f"**{title.strip()}**\n" if title and title.strip() else ""
    return (header + body).strip()


def find_sensitive(message: str) -> str | None:
    for label, pattern in SENSITIVE_PATTERNS.items():
        if pattern.search(message):
            return label
    return None


def enforce_limit(message: str, limit: int = DISCORD_CONTENT_LIMIT) -> str:
    if len(message) <= limit:
        return message
    return message[: limit - 1].rstrip() + "…"


def git_commit_subjects(range_spec: str) -> list[str]:
    result = subprocess.run(
        ["git", "log", "--no-merges", "--pretty=format:%s", range_spec],
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    )
    return [line for line in result.stdout.splitlines() if line.strip()]


def default_range(root: Path) -> str:
    # 마지막 태그 이후를 기본 범위로 삼고, 태그가 없으면 최근 10개 커밋을 쓴다.
    tag = subprocess.run(
        ["git", "describe", "--tags", "--abbrev=0"],
        cwd=root,
        capture_output=True,
        text=True,
    )
    latest_tag = tag.stdout.strip()
    return f"{latest_tag}..HEAD" if tag.returncode == 0 and latest_tag else "HEAD~10..HEAD"


def build_message(args: argparse.Namespace, root: Path) -> str:
    header = f"**{args.title.strip()}**\n" if args.title and args.title.strip() else ""
    if args.message:
        return (header + args.message.strip()).strip()
    if args.summary_file:
        text = Path(args.summary_file).read_text(encoding="utf-8").strip()
        return (header + text).strip()
    range_spec = f"{args.since}..HEAD" if args.since else default_range(root)
    subjects = git_commit_subjects(range_spec)
    if not subjects:
        raise ValueError(f"no commits found in range {range_spec}")
    return compose_message(args.title, subjects)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Post a short redacted done-note to a Discord #DONE channel.")
    parser.add_argument("--message", help="one-line note to post directly; the shortest path")
    parser.add_argument("--summary-file", type=Path, help="human-written note; used when --message is absent")
    parser.add_argument("--since", help="git ref (tag/commit) to draft from; defaults to last tag or last 10 commits")
    parser.add_argument("--title", help="optional bold header line")
    parser.add_argument("--send", action="store_true", help=f"actually post; requires {WEBHOOK_ENV}")
    args = parser.parse_args(argv)
    # Windows 콘솔(cp949)에서도 불릿·한글 미리보기가 깨지지 않게 UTF-8로 출력한다.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    root = Path(__file__).resolve().parents[1]
    try:
        message = enforce_limit(build_message(args, root))
        sensitive = find_sensitive(message)
        if sensitive:
            raise ValueError(f"message matches '{sensitive}'; refusing to send")
        if not args.send:
            print(message)
            print(f"\n(dry-run: pass --send with {WEBHOOK_ENV} set to post)")
            return 0
        webhook_url = os.environ.get(WEBHOOK_ENV, "")
        if not webhook_url:
            raise ValueError(f"{WEBHOOK_ENV} is required with --send")
        if not is_discord_webhook(webhook_url):
            raise ValueError(f"{WEBHOOK_ENV} must be an HTTPS Discord webhook URL")
        send_message(webhook_url, message)
        print("PASS: posted done-note to the Discord #DONE channel")
    except (OSError, UnicodeError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"FAIL: {error}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
