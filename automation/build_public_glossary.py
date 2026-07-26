"""Resolve which approved glossary terms appear in which approved public record.

Matching is deterministic substring search. Korean particles attach after a stem
(폴백 → 폴백이 · 폴백을), so finding the stem needs no particle rules; the rendered
span stops at the alias and leaves the particle outside it. See ADR-0008.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from automation import build_public_content
    from automation.public_content import ParsedNote, glossary_notes, load_public_notes, record_notes
except ModuleNotFoundError:  # Direct execution: python automation/build_public_glossary.py
    import build_public_content
    from public_content import ParsedNote, glossary_notes, load_public_notes, record_notes

GLOSSARY_VERSION = 1
SUMMARY_LIMIT = 120
# Every mention records the surrounding sentence fragment so a reviewer can see a wrong
# substring match (노트 inside 노트북) in the artifact diff instead of on the live site.
CONTEXT_RADIUS = 24


def term_summary(body: str, limit: int = SUMMARY_LIMIT) -> str:
    """First paragraph of the term note, collapsed to one line for the tooltip."""
    paragraph = next((block.strip() for block in body.split("\n\n") if block.strip()), "")
    normalized = " ".join(paragraph.split())
    if len(normalized) <= limit:
        return normalized
    return normalized[:limit].rstrip() + "…"


def build_terms(notes: list[ParsedNote]) -> list[dict[str, object]]:
    terms = [
        {
            "id": str(note.metadata["id"]),
            "title": str(note.metadata["title"]),
            "summary": term_summary(note.body),
            "aliases": sorted({str(alias) for alias in note.metadata["aliases"]}),
        }
        for note in glossary_notes(notes)
    ]
    terms.sort(key=lambda term: str(term["id"]))
    return terms


def resolve_mentions(body: str, terms: list[dict[str, object]]) -> list[dict[str, str]]:
    """Pick at most one span per term: earliest match wins, longer alias breaks ties.

    Spans never overlap. A longer alias claiming a range removes any shorter alias
    inside it, so 결정론적 빌드 wins over 빌드 in the same sentence.
    """
    def longest_alias(term: dict[str, object]) -> int:
        aliases = term["aliases"]
        assert isinstance(aliases, list)
        return max(len(str(alias)) for alias in aliases)

    # A term with a longer alias claims its span first, so 결정론적 빌드 beats 빌드 nested in it.
    ordered = sorted(terms, key=lambda term: (-longest_alias(term), str(term["id"])))
    claimed: list[tuple[int, int]] = []
    mentions: list[dict[str, str]] = []
    for term in ordered:
        aliases = term["aliases"]
        assert isinstance(aliases, list)
        occurrences: list[tuple[int, int, str]] = []
        for raw_alias in aliases:
            alias = str(raw_alias)
            position = body.find(alias)
            while position != -1:
                occurrences.append((position, -len(alias), alias))
                position = body.find(alias, position + 1)
        occurrences.sort()

        for start, negative_length, alias in occurrences:
            end = start - negative_length
            # A swallowed first occurrence must not hide the term; keep scanning for a free span.
            if any(start < claimed_end and claimed_start < end for claimed_start, claimed_end in claimed):
                continue
            claimed.append((start, end))
            mentions.append(
                {"term": str(term["id"]), "alias": alias, "context": match_context(body, start, end)}
            )
            break

    mentions.sort(key=lambda mention: (mention["term"], mention["alias"]))
    return mentions


def match_context(body: str, start: int, end: int) -> str:
    """One-line fragment around a match so reviewers can judge it from the artifact diff."""
    before = " ".join(body[max(0, start - CONTEXT_RADIUS) : start].split())
    matched = " ".join(body[start:end].split())
    after = " ".join(body[end : end + CONTEXT_RADIUS].split())
    prefix = "…" if start - CONTEXT_RADIUS > 0 else ""
    suffix = "…" if end + CONTEXT_RADIUS < len(body) else ""
    return f"{prefix}{before}[{matched}]{after}{suffix}"


def build_payload_from_notes(notes: list[ParsedNote]) -> dict[str, object]:
    terms = build_terms(notes)
    term_ids = {str(term["id"]) for term in terms}
    mentions: list[dict[str, str]] = []
    if terms:
        for note in record_notes(notes):
            note_id = str(note.metadata["id"])
            for mention in resolve_mentions(note.body.strip(), terms):
                mentions.append({"note": note_id, **mention})

    mentions.sort(key=lambda mention: (mention["note"], mention["term"], mention["alias"]))
    payload: dict[str, object] = {"version": GLOSSARY_VERSION, "terms": terms, "mentions": mentions}
    validate_glossary_payload(payload, term_ids)
    return payload


def build_payload(source: Path) -> dict[str, object]:
    return build_payload_from_notes(load_public_notes(source))


def validate_glossary_payload(payload: object, expected_term_ids: set[str] | None = None) -> None:
    """Validate the generated artifact without adding a JSON Schema dependency."""
    if not isinstance(payload, dict) or set(payload) != {"version", "terms", "mentions"}:
        raise ValueError("glossary root must contain only version, terms, and mentions")
    if payload["version"] != GLOSSARY_VERSION:
        raise ValueError(f"glossary version must be {GLOSSARY_VERSION}")
    terms, mentions = payload["terms"], payload["mentions"]
    if not isinstance(terms, list) or not isinstance(mentions, list):
        raise ValueError("glossary terms and mentions must be arrays")

    aliases_by_term: dict[str, set[str]] = {}
    claimed_aliases: set[str] = set()
    previous_term_id: str | None = None
    for index, term in enumerate(terms):
        if not isinstance(term, dict) or set(term) != {"id", "title", "summary", "aliases"}:
            raise ValueError(f"term[{index}] has an invalid schema")
        term_id = term["id"]
        if not isinstance(term_id, str) or not term_id:
            raise ValueError(f"term[{index}] has an invalid id")
        if term_id in aliases_by_term:
            raise ValueError(f"duplicate glossary term id: {term_id}")
        if previous_term_id is not None and term_id < previous_term_id:
            raise ValueError("glossary terms must be sorted by id")
        for field in ("title", "summary"):
            if not isinstance(term[field], str) or not term[field].strip():
                raise ValueError(f"term[{index}] {field} must be a non-empty string")
        aliases = term["aliases"]
        if not isinstance(aliases, list) or not aliases:
            raise ValueError(f"term[{index}] aliases must be a non-empty array")
        if aliases != sorted(set(aliases)):
            raise ValueError(f"term[{index}] aliases must be unique and sorted")
        for alias in aliases:
            if not isinstance(alias, str) or not alias.strip():
                raise ValueError(f"term[{index}] aliases must be non-empty strings")
            if alias in claimed_aliases:
                raise ValueError(f"alias is claimed by more than one term: {alias}")
            claimed_aliases.add(alias)
        aliases_by_term[term_id] = set(aliases)
        previous_term_id = term_id

    if expected_term_ids is not None and set(aliases_by_term) != expected_term_ids:
        raise ValueError("glossary term ids do not match the approved public source")

    seen: set[tuple[str, str]] = set()
    previous_key: tuple[str, str, str] | None = None
    for index, mention in enumerate(mentions):
        if not isinstance(mention, dict) or set(mention) != {"note", "term", "alias", "context"}:
            raise ValueError(f"mention[{index}] has an invalid schema")
        note_id, term_id, alias = mention["note"], mention["term"], mention["alias"]
        if not all(isinstance(value, str) and value for value in (note_id, term_id, alias, mention["context"])):
            raise ValueError(f"mention[{index}] fields must be non-empty strings")
        if f"[{alias}]" not in mention["context"]:
            raise ValueError(f"mention[{index}] context must show the matched alias")
        if term_id not in aliases_by_term:
            raise ValueError(f"mention[{index}] references an unknown term: {term_id}")
        if alias not in aliases_by_term[term_id]:
            raise ValueError(f"mention[{index}] alias is not declared by its term: {alias}")
        if note_id == term_id:
            raise ValueError(f"mention[{index}] must not annotate its own term note")
        if (note_id, term_id) in seen:
            raise ValueError(f"mention[{index}] repeats a term inside one note: {note_id}/{term_id}")
        key = (note_id, term_id, alias)
        if previous_key is not None and key < previous_key:
            raise ValueError("glossary mentions must be sorted by note, term, and alias")
        seen.add((note_id, term_id))
        previous_key = key


def render_payload(payload: dict[str, object]) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def public_index_is_current(notes: list[ParsedNote], index_path: Path) -> bool:
    expected = build_public_content.render_payload(build_public_content.build_payload_from_notes(notes))
    return build_public_content.output_matches(index_path, expected)


def validate_existing_glossary(output: Path, expected_term_ids: set[str]) -> None:
    if not output.is_file():
        raise ValueError("generated public glossary is missing")
    try:
        payload = json.loads(output.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ValueError("generated public glossary is not valid JSON") from error
    validate_glossary_payload(payload, expected_term_ids)


def collect_glossary_warnings(payload: dict[str, object]) -> list[str]:
    """Report terms that are approved but never displayed; they cost bundle size for nothing."""
    mentions = payload["mentions"]
    assert isinstance(mentions, list)
    mentioned = {str(mention["term"]) for mention in mentions}
    terms = payload["terms"]
    assert isinstance(terms, list)
    return [f"term id={term['id']} rule=no_matching_record" for term in terms if str(term["id"]) not in mentioned]


def main(argv: list[str] | None = None) -> int:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Build the approved CORCOIDUM-Public glossary artifact.")
    parser.add_argument("--source", type=Path, default=root / "vaults" / "CORCOIDUM-Public")
    parser.add_argument("--index", type=Path, default=root / "content" / "public" / "index.json")
    parser.add_argument("--output", type=Path, default=root / "content" / "public" / "glossary.json")
    parser.add_argument("--check", action="store_true", help="fail when the generated glossary is missing or stale")
    args = parser.parse_args(argv)

    try:
        notes = load_public_notes(args.source)
        if not public_index_is_current(notes, args.index):
            raise ValueError(f"public content gate failed: approved-content index is missing or stale: {args.index}")
        payload = build_payload_from_notes(notes)
        rendered = render_payload(payload)
        expected_term_ids = {str(term["id"]) for term in payload["terms"]}
        if args.check:
            validate_existing_glossary(args.output, expected_term_ids)
    except (OSError, UnicodeError, ValueError) as error:
        print(f"FAIL: {error}")
        return 1

    for warning in collect_glossary_warnings(payload):
        print(f"WARN: {warning}")

    if args.check:
        if build_public_content.output_matches(args.output, rendered):
            print(f"PASS: approved public glossary is current: {args.output}")
            return 0
        print(f"FAIL: generated public glossary is stale: {args.output}")
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(rendered, encoding="utf-8")
    terms, mentions = payload["terms"], payload["mentions"]
    assert isinstance(terms, list) and isinstance(mentions, list)
    print(f"PASS: wrote {len(terms)} term(s) and {len(mentions)} mention(s) to {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
