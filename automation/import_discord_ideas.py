"""Import new messages from the private Discord ideas channel into a local Obsidian inbox.

Discord is the capture entrance only; the Obsidian vault stays the source of truth.
The inbox must live outside this repository so raw ideas never reach the public repo.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

try:
    from automation.validate_notes import SENSITIVE_PATTERNS
except ModuleNotFoundError:  # Direct execution: python automation/import_discord_ideas.py
    from validate_notes import SENSITIVE_PATTERNS

DISCORD_API = "https://discord.com/api/v10"
STATE_FILENAME = ".discord-ideas-state.json"
PAGE_LIMIT = 100


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def ensure_inbox_outside_repo(inbox: Path) -> None:
    resolved = inbox.resolve()
    if resolved.is_relative_to(repo_root()):
        raise ValueError("inbox must be outside this repository; raw ideas must not enter the public repo")


def load_state(inbox: Path) -> str | None:
    state_path = inbox / STATE_FILENAME
    if not state_path.exists():
        return None
    payload = json.loads(state_path.read_text(encoding="utf-8"))
    last_id = payload.get("last_message_id")
    return last_id if isinstance(last_id, str) and last_id.isdigit() else None


def save_state(inbox: Path, last_message_id: str) -> None:
    (inbox / STATE_FILENAME).write_text(
        json.dumps({"last_message_id": last_message_id}, indent=2) + "\n", encoding="utf-8"
    )


def fetch_messages(token: str, channel_id: str, after_id: str | None) -> list[dict[str, object]]:
    messages: list[dict[str, object]] = []
    cursor = after_id or "0"
    while True:
        query = urlencode({"limit": PAGE_LIMIT, "after": cursor})
        request = Request(
            f"{DISCORD_API}/channels/{channel_id}/messages?{query}",
            headers={
                "Authorization": f"Bot {token}",
                # Discord's edge rejects the default Python-urllib User-Agent with 403.
                "User-Agent": "corcoidum-os-automation/1.0",
            },
        )
        with urlopen(request, timeout=15) as response:
            batch = json.loads(response.read().decode("utf-8"))
        if not isinstance(batch, list) or not batch:
            return messages
        messages.extend(batch)
        cursor = max(str(message["id"]) for message in batch if str(message.get("id", "")).isdigit())
        if len(batch) < PAGE_LIMIT:
            return messages


def select_importable(messages: list[dict[str, object]]) -> list[dict[str, object]]:
    importable = [
        message
        for message in messages
        if str(message.get("id", "")).isdigit()
        and not (message.get("author") or {}).get("bot", False)
        and str(message.get("content", "")).strip()
    ]
    return sorted(importable, key=lambda message: int(str(message["id"])))


def sensitive_label(content: str) -> str | None:
    for label, pattern in SENSITIVE_PATTERNS.items():
        if pattern.search(content):
            return label
    return None


def to_utc_stamp(timestamp: str) -> datetime:
    return datetime.fromisoformat(timestamp).astimezone(UTC)


def build_note(message: dict[str, object]) -> tuple[str, str, str | None]:
    message_id = str(message["id"])
    content = str(message["content"]).strip()
    captured = to_utc_stamp(str(message["timestamp"]))
    warning = sensitive_label(content)
    filename = f"idea-{captured.strftime('%Y%m%d-%H%M%S')}-{message_id[-6:]}.md"
    lines = [
        "---",
        f"captured_at: {captured.strftime('%Y-%m-%dT%H:%M:%SZ')}",
        f"imported_at: {datetime.now(UTC).strftime('%Y-%m-%dT%H:%M:%SZ')}",
        "source: discord-ideas",
        f'message_id: "{message_id}"',
        "status: inbox",
    ]
    if warning:
        lines.append(f"sensitive_warning: {warning}")
    lines.extend(["---", "", content, ""])
    return filename, "\n".join(lines), warning


def import_ideas(token: str, channel_id: str, inbox: Path) -> int:
    ensure_inbox_outside_repo(inbox)
    inbox.mkdir(parents=True, exist_ok=True)
    messages = select_importable(fetch_messages(token, channel_id, load_state(inbox)))
    warnings = 0
    for message in messages:
        filename, note, warning = build_note(message)
        (inbox / filename).write_text(note, encoding="utf-8")
        if warning:
            warnings += 1
            print(f"WARN: {filename} matches '{warning}'. Delete the original Discord message; it already left the boundary.")
    if messages:
        save_state(inbox, str(messages[-1]["id"]))
    print(f"PASS: imported {len(messages)} idea(s) into {inbox}" + (f" with {warnings} sensitive warning(s)" if warnings else ""))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Import new Discord ideas-channel messages into a local Obsidian inbox.")
    parser.add_argument("--inbox", type=Path, default=os.environ.get("IDEAS_INBOX_DIR"), help="local inbox directory outside this repo")
    parser.add_argument("--channel", default=os.environ.get("DISCORD_IDEAS_CHANNEL_ID"), help="Discord channel ID")
    args = parser.parse_args(argv)
    token = os.environ.get("DISCORD_BOT_TOKEN", "")
    try:
        if not token:
            raise ValueError("DISCORD_BOT_TOKEN is required (set it in the local environment only)")
        if not args.channel or not str(args.channel).isdigit():
            raise ValueError("a numeric Discord channel ID is required (--channel or DISCORD_IDEAS_CHANNEL_ID)")
        if not args.inbox:
            raise ValueError("an inbox directory is required (--inbox or IDEAS_INBOX_DIR)")
        return import_ideas(token, str(args.channel), Path(args.inbox))
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as error:
        print(f"FAIL: {error}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
