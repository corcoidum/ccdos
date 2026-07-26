"""Shared loading boundary for approved public content artifacts."""

from __future__ import annotations

from pathlib import Path

try:
    from automation.validate_notes import (
        GLOSSARY_KIND,
        PUBLISHABLE_STATES,
        ParsedNote,
        format_issue,
        load_and_validate_notes,
        markdown_files,
    )
except ModuleNotFoundError:  # Direct execution through a sibling automation script.
    from validate_notes import (
        GLOSSARY_KIND,
        PUBLISHABLE_STATES,
        ParsedNote,
        format_issue,
        load_and_validate_notes,
        markdown_files,
    )


def load_public_notes(source: Path) -> list[ParsedNote]:
    """Read and validate the Public Vault once for all derived artifact builders."""
    files = markdown_files([source])
    if not files:
        raise ValueError(f"no Markdown notes found in {source}")

    notes, issues = load_and_validate_notes(files)
    if issues:
        messages = "\n".join(format_issue(issue) for issue in issues)
        raise ValueError(f"public content validation failed:\n{messages}")
    return notes


def publishable_notes(notes: list[ParsedNote]) -> list[ParsedNote]:
    return [note for note in notes if note.metadata.get("publish_state") in PUBLISHABLE_STATES]


def record_notes(notes: list[ParsedNote]) -> list[ParsedNote]:
    """Approved reading records: everything that is not a glossary term."""
    return [note for note in publishable_notes(notes) if note.metadata.get("note_kind") != GLOSSARY_KIND]


def glossary_notes(notes: list[ParsedNote]) -> list[ParsedNote]:
    return [note for note in publishable_notes(notes) if note.metadata.get("note_kind") == GLOSSARY_KIND]
