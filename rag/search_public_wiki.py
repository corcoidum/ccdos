"""Search explicitly approved public sources and return citation-ready evidence."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

PUBLISHABLE_STATES = {"approved", "published"}
TOKEN_PATTERN = re.compile(r"[0-9A-Za-z가-힣_]+")


def tokenize(text: str) -> list[str]:
    return [token.lower() for token in TOKEN_PATTERN.findall(text)]


def approved_notes(payload: dict[str, object]) -> list[dict[str, object]]:
    notes = payload.get("notes", [])
    if not isinstance(notes, list):
        return []
    return [
        note
        for note in notes
        if isinstance(note, dict) and note.get("state") in PUBLISHABLE_STATES
    ]


def score_note(note: dict[str, object], query_tokens: list[str]) -> int:
    title_counts = Counter(tokenize(str(note.get("title", ""))))
    tag_counts = Counter(tokenize(" ".join(str(tag) for tag in note.get("tags", []))))
    body_counts = Counter(tokenize(str(note.get("body", ""))))
    return sum(
        4 * title_counts[token] + 3 * tag_counts[token] + body_counts[token]
        for token in query_tokens
    )


def excerpt(body: str, query_tokens: list[str], limit: int = 180) -> str:
    normalized = " ".join(body.split())
    lower_body = normalized.lower()
    match_index = next(
        (position for position in (lower_body.find(token) for token in query_tokens) if position >= 0),
        0,
    )
    start = max(match_index - 40, 0)
    end = min(start + limit, len(normalized))
    prefix = "…" if start else ""
    suffix = "…" if end < len(normalized) else ""
    return f"{prefix}{normalized[start:end]}{suffix}"


def search_public_wiki(payload: dict[str, object], query: str, limit: int = 5) -> dict[str, object]:
    query_tokens = tokenize(query)
    if not query_tokens:
        return {"query": query, "answer": "검색어를 입력해 주세요.", "sources": []}

    ranked = [
        (score_note(note, query_tokens), note)
        for note in approved_notes(payload)
    ]
    ranked = [(score, note) for score, note in ranked if score > 0]
    ranked.sort(key=lambda item: (item[0], str(item[1].get("updated", ""))), reverse=True)
    sources = [
        {
            "id": str(note.get("id", "")),
            "title": str(note.get("title", "")),
            "updated": str(note.get("updated", "")),
            "tags": note.get("tags", []),
            "excerpt": excerpt(str(note.get("body", "")), query_tokens),
        }
        for _, note in ranked[:limit]
    ]
    answer = (
        "아래 승인된 공개 출처를 확인하세요. 이 MVP는 답변을 추측하지 않고 근거만 제공합니다."
        if sources
        else "일치하는 승인된 공개 출처가 없습니다. 비공개 또는 미승인 자료는 검색하지 않습니다."
    )
    return {"query": query, "answer": answer, "sources": sources}


def main(argv: list[str] | None = None) -> int:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Search only approved CORCOIDUM public sources.")
    parser.add_argument("query", help="search terms; this command does not transmit the query externally")
    parser.add_argument("--index", type=Path, default=root / "content" / "public" / "index.json")
    parser.add_argument("--limit", type=int, default=5)
    args = parser.parse_args(argv)
    payload = json.loads(args.index.read_text(encoding="utf-8"))
    print(json.dumps(search_public_wiki(payload, args.query, args.limit), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
