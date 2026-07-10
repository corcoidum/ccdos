"""Format or optionally send a redacted automation status message to Discord."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen


def format_message(report: dict[str, object]) -> str:
    checks = report["checks"]
    failed_count = sum(check["status"] == "failed" for check in checks if isinstance(check, dict))
    status = "PASS" if report["overall_status"] == "passed" else "FAIL"
    return (
        f"CORCOIDUM OS automation: {status}\n"
        f"Approved public notes: {report['approved_public_note_count']}\n"
        f"Checks: {len(checks) - failed_count} passed, {failed_count} failed\n"
        f"Generated: {report['generated_at']}"
    )


def is_discord_webhook(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme == "https" and parsed.netloc in {"discord.com", "discordapp.com"} and parsed.path.startswith("/api/webhooks/")


def send_message(webhook_url: str, message: str) -> None:
    if not is_discord_webhook(webhook_url):
        raise ValueError("DISCORD_WEBHOOK_URL must be an HTTPS Discord webhook URL")
    # Discord's edge rejects the default Python-urllib User-Agent with 403.
    request = Request(
        webhook_url,
        data=json.dumps({"content": message}).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "corcoidum-os-automation/1.0"},
        method="POST",
    )
    with urlopen(request, timeout=10) as response:
        if response.status not in {200, 204}:
            raise RuntimeError(f"Discord webhook returned HTTP {response.status}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Format or send a redacted CORCOIDUM OS Discord notification.")
    parser.add_argument("--report", required=True, type=Path, help="status report JSON path")
    parser.add_argument("--send", action="store_true", help="send only when DISCORD_WEBHOOK_URL is configured")
    args = parser.parse_args(argv)
    try:
        report = json.loads(args.report.read_text(encoding="utf-8"))
        message = format_message(report)
        if args.send:
            webhook_url = os.environ.get("DISCORD_WEBHOOK_URL", "")
            if not webhook_url:
                raise ValueError("DISCORD_WEBHOOK_URL is required with --send")
            send_message(webhook_url, message)
            print("PASS: sent redacted Discord status notification")
        else:
            print(message)
    except (KeyError, OSError, TypeError, UnicodeError, ValueError, RuntimeError) as error:
        print(f"FAIL: {error}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
