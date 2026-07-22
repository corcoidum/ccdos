"""Smoke-check the deployed grounded answer layer.

CI runs the Playwright suite without `OPENAI_API_KEY`, so it can only prove the
retrieval fallback works. That left a gap: the generated path could break in
production and every request would degrade silently, keeping CI green. This
check runs against the deployed URL and separates a *healthy* fallback (the
budget or rate limit did its job) from a *misconfigured* one.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

DEFAULT_URL = "https://ccdos.corcoidum.workers.dev/api/answer"
DEFAULT_QUERY = "automation"
TIMEOUT_SECONDS = 30
DEFAULT_ATTEMPTS = 4
RETRY_DELAY_SECONDS = 3

# The generated path is configured and reachable; throttling is a healthy answer.
HEALTHY_REASONS = {"rate_limited", "budget_exhausted"}
# The model replied but the safety gate rejected it: worth reporting, not a config break.
QUALITY_REASONS = {"empty_answer", "invalid_citations"}
# Nothing a visitor does can produce these; they mean the deployment is broken.
BROKEN_REASONS = {"not_configured", "provider_error", "infrastructure_error"}


def request_answer(url: str, query: str) -> dict[str, object]:
    request = urllib.request.Request(
        url,
        data=json.dumps({"query": query}).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            # The edge answers the default Python-urllib User-Agent with 403,
            # the same layer that once broke the Discord webhook.
            "User-Agent": "corcoidum-os-automation/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def evaluate(payload: dict[str, object]) -> tuple[int, str]:
    """Return (exit code, human summary). Never echo the answer text itself."""
    mode = payload.get("mode")
    reason = str(payload.get("reason", ""))
    source_count = len(payload.get("sources", []) or [])

    if mode == "generated":
        return 0, f"PASS: generated answer with {source_count} approved source(s)"
    if reason == "no_sources":
        return 1, "FAIL: smoke query matched no approved sources; pick a query that has evidence"
    if reason in HEALTHY_REASONS:
        return 0, f"PASS: answer layer reachable, currently throttled ({reason})"
    if reason in QUALITY_REASONS:
        return 0, f"WARN: provider replied but the safety gate rejected it ({reason})"
    if reason in BROKEN_REASONS:
        diagnostic = payload.get("diagnostic")
        detail = f" [diagnostic: {diagnostic}]" if diagnostic else ""
        return 1, f"FAIL: generated answer layer is down ({reason}){detail}"
    return 1, f"FAIL: unexpected answer payload (mode={mode!r}, reason={reason!r})"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Smoke-check the deployed answer layer.")
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--query", default=DEFAULT_QUERY)
    parser.add_argument("--attempts", type=int, default=DEFAULT_ATTEMPTS)
    args = parser.parse_args(argv)

    # The question is "can this deployment produce a grounded answer at all",
    # not "did one call succeed". Retrying keeps a partially degraded provider
    # from turning the gate into a coin flip, while a fully broken layer still
    # fails every attempt.
    summary = "FAIL: no attempt completed"
    for attempt in range(1, max(args.attempts, 1) + 1):
        try:
            payload = request_answer(args.url, args.query)
        except urllib.error.HTTPError as error:
            # Name the status: a bare exception class hides whether this is the
            # edge, the route, or the Worker rejecting the request.
            summary = f"FAIL: answer layer returned HTTP {error.code}"
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            summary = f"FAIL: cannot reach the answer layer: {type(error).__name__}"
        else:
            exit_code, summary = evaluate(payload)
            if exit_code == 0:
                if attempt > 1:
                    summary += f" (attempt {attempt}/{args.attempts})"
                print(summary)
                return 0
        if attempt < args.attempts:
            time.sleep(RETRY_DELAY_SECONDS)

    print(f"{summary} after {args.attempts} attempt(s)")
    return 1


if __name__ == "__main__":
    sys.exit(main())
