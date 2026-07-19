"""Build a deterministic note-to-note graph from approved public Markdown."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from automation import build_public_content
    from automation.public_content import ParsedNote, load_public_notes, publishable_notes
    from automation.validate_notes import ID_PATTERN, PUBLISHABLE_STATES, RELATION_TYPES, is_utc_timestamp
except ModuleNotFoundError:  # Direct execution: python automation/build_public_graph.py
    import build_public_content
    from public_content import ParsedNote, load_public_notes, publishable_notes
    from validate_notes import ID_PATTERN, PUBLISHABLE_STATES, RELATION_TYPES, is_utc_timestamp

GRAPH_VERSION = 2
MAX_RELATIONS_WARNING = 12
NODE_FIELDS = {
    "id",
    "type",
    "label",
    "url",
    "tags",
    "state",
    "updated",
    "published_at",
    "backlinks",
    "related_notes",
}
EDGE_FIELDS = {"source", "target", "type"}
BACKLINK_FIELDS = {"source", "type"}


def build_payload_from_notes(notes: list[ParsedNote]) -> dict[str, object]:
    """Create stable graph nodes and human-declared directed edges."""
    nodes: list[dict[str, object]] = []
    edges: list[dict[str, str]] = []
    approved_notes = publishable_notes(notes)
    for note in approved_notes:
        metadata = note.metadata
        note_id = str(metadata["id"])
        nodes.append(
            {
                "id": note_id,
                "type": "note",
                "label": metadata["title"],
                "url": "/garden",
                "tags": sorted(str(tag) for tag in metadata["tags"]),
                "state": metadata["publish_state"],
                "updated": metadata["updated"],
                "published_at": metadata.get("published_at"),
                "backlinks": [],
                "related_notes": [],
            }
        )
        for relation in metadata.get("relations", []):
            edges.append(
                {
                    "source": note_id,
                    "target": str(relation["target"]),
                    "type": str(relation["type"]),
                }
            )

    nodes.sort(key=lambda node: str(node["id"]))
    edges.sort(key=lambda edge: (edge["source"], edge["target"], edge["type"]))
    backlinks_by_id: dict[str, list[dict[str, str]]] = {str(node["id"]): [] for node in nodes}
    related_by_id: dict[str, set[str]] = {str(node["id"]): set() for node in nodes}
    for edge in edges:
        backlinks_by_id[edge["target"]].append({"source": edge["source"], "type": edge["type"]})
        if edge["type"] == "related_to":
            related_by_id[edge["source"]].add(edge["target"])
            related_by_id[edge["target"]].add(edge["source"])
    for node in nodes:
        node_id = str(node["id"])
        node["backlinks"] = sorted(
            backlinks_by_id[node_id],
            key=lambda backlink: (backlink["source"], backlink["type"]),
        )
        node["related_notes"] = sorted(related_by_id[node_id])

    payload: dict[str, object] = {"version": GRAPH_VERSION, "nodes": nodes, "edges": edges}
    validate_graph_payload(payload, {str(note.metadata["id"]) for note in approved_notes})
    return payload


def build_payload(source: Path) -> dict[str, object]:
    return build_payload_from_notes(load_public_notes(source))


def validate_graph_payload(payload: object, expected_node_ids: set[str] | None = None) -> None:
    """Validate the generated artifact without adding a JSON Schema dependency."""
    if not isinstance(payload, dict) or set(payload) != {"version", "nodes", "edges"}:
        raise ValueError("graph root must contain only version, nodes, and edges")
    if payload["version"] != GRAPH_VERSION:
        raise ValueError(f"graph version must be {GRAPH_VERSION}")
    nodes = payload["nodes"]
    edges = payload["edges"]
    if not isinstance(nodes, list) or not isinstance(edges, list):
        raise ValueError("graph nodes and edges must be arrays")

    node_ids: set[str] = set()
    backlinks_by_id: dict[str, list[tuple[str, str]]] = {}
    related_by_id: dict[str, list[str]] = {}
    previous_node_id: str | None = None
    for index, node in enumerate(nodes):
        if not isinstance(node, dict) or set(node) != NODE_FIELDS:
            raise ValueError(f"node[{index}] has an invalid schema")
        node_id = node["id"]
        if not isinstance(node_id, str) or not ID_PATTERN.fullmatch(node_id):
            raise ValueError(f"node[{index}] has an invalid id")
        if node_id in node_ids:
            raise ValueError(f"duplicate graph node id: {node_id}")
        if previous_node_id is not None and node_id < previous_node_id:
            raise ValueError("graph nodes must be sorted by id")
        if node["type"] != "note" or not isinstance(node["label"], str) or not node["label"].strip():
            raise ValueError(f"node[{index}] must be a labeled note")
        if node["url"] != "/garden":
            raise ValueError(f"node[{index}] has an unsupported public route")
        tags = node["tags"]
        if not isinstance(tags, list) or not tags or any(not isinstance(tag, str) or not tag for tag in tags):
            raise ValueError(f"node[{index}] tags must be a non-empty string array")
        if tags != sorted(tags):
            raise ValueError(f"node[{index}] tags must be sorted")
        if node["state"] not in PUBLISHABLE_STATES:
            raise ValueError(f"node[{index}] is not approved for public output")
        if not is_utc_timestamp(node["updated"]):
            raise ValueError(f"node[{index}] updated must be a UTC timestamp")
        if node["published_at"] is not None and not is_utc_timestamp(node["published_at"]):
            raise ValueError(f"node[{index}] published_at must be null or a UTC timestamp")
        backlinks = node["backlinks"]
        if not isinstance(backlinks, list):
            raise ValueError(f"node[{index}] backlinks must be an array")
        backlink_keys: list[tuple[str, str]] = []
        for backlink_index, backlink in enumerate(backlinks):
            if not isinstance(backlink, dict) or set(backlink) != BACKLINK_FIELDS:
                raise ValueError(f"node[{index}] backlink[{backlink_index}] has an invalid schema")
            source, relation_type = backlink["source"], backlink["type"]
            if not isinstance(source, str) or not isinstance(relation_type, str):
                raise ValueError(f"node[{index}] backlink[{backlink_index}] fields must be strings")
            backlink_keys.append((source, relation_type))
        if backlink_keys != sorted(set(backlink_keys)):
            raise ValueError(f"node[{index}] backlinks must be unique and sorted")

        related_notes = node["related_notes"]
        if not isinstance(related_notes, list) or any(not isinstance(note_id, str) for note_id in related_notes):
            raise ValueError(f"node[{index}] related_notes must be a string array")
        if related_notes != sorted(set(related_notes)):
            raise ValueError(f"node[{index}] related_notes must be unique and sorted")

        backlinks_by_id[node_id] = backlink_keys
        related_by_id[node_id] = related_notes
        node_ids.add(node_id)
        previous_node_id = node_id

    if expected_node_ids is not None and node_ids != expected_node_ids:
        raise ValueError("graph node ids do not match the approved public source")

    for node_id, backlinks in backlinks_by_id.items():
        if any(source not in node_ids or source == node_id or relation_type not in RELATION_TYPES for source, relation_type in backlinks):
            raise ValueError(f"node id={node_id} has an invalid backlink reference")
    for node_id, related_notes in related_by_id.items():
        if any(related_id not in node_ids or related_id == node_id for related_id in related_notes):
            raise ValueError(f"node id={node_id} has an invalid related note reference")

    seen_edges: set[tuple[str, str, str]] = set()
    expected_backlinks: dict[str, list[tuple[str, str]]] = {node_id: [] for node_id in node_ids}
    expected_related: dict[str, set[str]] = {node_id: set() for node_id in node_ids}
    previous_edge: tuple[str, str, str] | None = None
    for index, edge in enumerate(edges):
        if not isinstance(edge, dict) or set(edge) != EDGE_FIELDS:
            raise ValueError(f"edge[{index}] has an invalid schema")
        source, target, relation_type = edge["source"], edge["target"], edge["type"]
        if not all(isinstance(value, str) for value in (source, target, relation_type)):
            raise ValueError(f"edge[{index}] fields must be strings")
        edge_key = (source, target, relation_type)
        if edge_key in seen_edges:
            raise ValueError(f"edge[{index}] duplicates a source-target-type edge")
        if previous_edge is not None and edge_key < previous_edge:
            raise ValueError("graph edges must be sorted by source, target, and type")
        if source not in node_ids or target not in node_ids:
            raise ValueError(f"edge[{index}] references a node outside the public graph")
        if source == target:
            raise ValueError(f"edge[{index}] must not reference its source")
        if relation_type not in RELATION_TYPES:
            raise ValueError(f"edge[{index}] has an unsupported relation type")
        expected_backlinks[target].append((source, relation_type))
        if relation_type == "related_to":
            expected_related[source].add(target)
            expected_related[target].add(source)
        seen_edges.add(edge_key)
        previous_edge = edge_key

    for node_id in sorted(node_ids):
        if backlinks_by_id[node_id] != sorted(expected_backlinks[node_id]):
            raise ValueError(f"node id={node_id} backlinks do not match graph edges")
        if related_by_id[node_id] != sorted(expected_related[node_id]):
            raise ValueError(f"node id={node_id} related_notes do not match related_to edges")


def collect_graph_warnings(notes: list[ParsedNote]) -> list[str]:
    """Report graph quality signals without blocking publication."""
    warnings: list[str] = []
    for note in sorted(publishable_notes(notes), key=lambda item: str(item.metadata["id"])):
        note_id = str(note.metadata["id"])
        relations = note.metadata.get("relations", [])
        if not relations:
            warnings.append(f"note id={note_id} rule=no_declared_relations")
            continue
        if len(relations) > MAX_RELATIONS_WARNING:
            warnings.append(f"note id={note_id} rule=relation_count_exceeds_{MAX_RELATIONS_WARNING}")
        types_by_target: dict[str, set[str]] = {}
        for relation in relations:
            types_by_target.setdefault(str(relation["target"]), set()).add(str(relation["type"]))
        for target, relation_types in sorted(types_by_target.items()):
            if len(relation_types) > 1:
                warnings.append(f"note id={note_id} target={target} rule=multiple_relation_types_require_review")
    return warnings


def render_payload(payload: dict[str, object]) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def public_index_is_current(notes: list[ParsedNote], index_path: Path) -> bool:
    expected = build_public_content.render_payload(build_public_content.build_payload_from_notes(notes))
    return build_public_content.output_matches(index_path, expected)


def validate_existing_graph(output: Path, expected_node_ids: set[str]) -> None:
    if not output.is_file():
        raise ValueError("generated public graph is missing")
    try:
        payload = json.loads(output.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ValueError("generated public graph is not valid JSON") from error
    validate_graph_payload(payload, expected_node_ids)


def main(argv: list[str] | None = None) -> int:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Build the approved CORCOIDUM-Public knowledge graph.")
    parser.add_argument("--source", type=Path, default=root / "vaults" / "CORCOIDUM-Public")
    parser.add_argument("--index", type=Path, default=root / "content" / "public" / "index.json")
    parser.add_argument("--output", type=Path, default=root / "content" / "public" / "graph.json")
    parser.add_argument("--check", action="store_true", help="fail when the generated graph is missing or stale")
    args = parser.parse_args(argv)

    try:
        notes = load_public_notes(args.source)
        if not public_index_is_current(notes, args.index):
            raise ValueError(f"public content gate failed: approved-content index is missing or stale: {args.index}")
        payload = build_payload_from_notes(notes)
        rendered = render_payload(payload)
        expected_node_ids = {str(node["id"]) for node in payload["nodes"]}
        if args.check:
            validate_existing_graph(args.output, expected_node_ids)
    except (OSError, UnicodeError, ValueError) as error:
        print(f"FAIL: {error}")
        return 1

    for warning in collect_graph_warnings(notes):
        print(f"WARN: {warning}")

    if args.check:
        if build_public_content.output_matches(args.output, rendered):
            print(f"PASS: approved public graph is current: {args.output}")
            return 0
        print(f"FAIL: generated public graph is stale: {args.output}")
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(rendered, encoding="utf-8")
    print(f"PASS: wrote {len(payload['nodes'])} node(s) and {len(payload['edges'])} edge(s) to {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
