from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from automation.build_public_content import build_payload as build_content_payload
from automation.build_public_content import render_payload as render_content_payload
from automation.build_public_graph import build_payload, main, render_payload, validate_graph_payload


def synthetic_note(
    note_id: str,
    *,
    state: str = "approved",
    relations: list[tuple[str | None, str | None]] | None = None,
) -> str:
    lines = [
        "---",
        f"id: {note_id}",
        f"title: Synthetic {note_id}",
        "created: 2026-07-10T00:00:00Z",
        "updated: 2026-07-10T00:00:00Z",
        "classification: S0_PUBLIC",
        "visibility: public",
        f"publish_state: {state}",
        "tags:",
        "  - synthetic",
    ]
    if relations:
        lines.append("relations:")
        for target, relation_type in relations:
            if target is None:
                lines.append(f"  - type: {relation_type or ''}")
            else:
                lines.append(f"  - target: {target}")
                if relation_type is not None:
                    lines.append(f"    type: {relation_type}")
    if state in {"review", "approved", "published"}:
        lines.extend(
            [
                "review_requested_at: 2026-07-10T00:10:00Z",
                "privacy_reviewed_by: synthetic-reviewer",
                "privacy_reviewed_at: 2026-07-10T00:20:00Z",
                "privacy_review_result: passed",
                "reviewed_revision: 2026-07-10T00:00:00Z",
            ]
        )
    if state in {"approved", "published"}:
        lines.extend(["approved_by: synthetic-owner", "approved_at: 2026-07-10T00:30:00Z"])
    if state == "published":
        lines.append("published_at: 2026-07-10T00:40:00Z")
    return "\n".join([*lines, "---", "", "Synthetic public body.", ""])


PRIVATE_NOTE = """---
id: private-local-note
title: Synthetic private note
created: 2026-07-10T00:00:00Z
updated: 2026-07-10T00:00:00Z
classification: S1_PRIVATE
visibility: private
publish_state: draft
tags:
  - synthetic
---

Synthetic private body.
"""


class BuildPublicGraphTests(unittest.TestCase):
    def write_public_note(self, root: Path, name: str, content: str) -> Path:
        path = root / "vaults" / "CORCOIDUM-Public" / "00_Drafts" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def source(self, root: Path) -> Path:
        return root / "vaults" / "CORCOIDUM-Public"

    def write_current_index(self, root: Path) -> Path:
        index = root / "content" / "public" / "index.json"
        index.parent.mkdir(parents=True, exist_ok=True)
        index.write_text(render_content_payload(build_content_payload(self.source(root))), encoding="utf-8")
        return index

    def test_builds_valid_relation_and_excludes_draft_node(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self.write_public_note(root, "b.md", synthetic_note("beta-note"))
            self.write_public_note(
                root,
                "a.md",
                synthetic_note("alpha-note", relations=[("beta-note", "related_to")]),
            )
            self.write_public_note(root, "draft.md", synthetic_note("draft-note", state="draft"))
            payload = build_payload(self.source(root))

        self.assertEqual([node["id"] for node in payload["nodes"]], ["alpha-note", "beta-note"])
        self.assertEqual(
            payload["edges"],
            [{"source": "alpha-note", "target": "beta-note", "type": "related_to"}],
        )
        nodes = {node["id"]: node for node in payload["nodes"]}
        self.assertEqual(nodes["alpha-note"]["url"], "/garden?note=alpha-note")
        self.assertEqual(nodes["beta-note"]["url"], "/garden?note=beta-note")
        self.assertEqual(nodes["alpha-note"]["backlinks"], [])
        self.assertEqual(nodes["alpha-note"]["related_notes"], ["beta-note"])
        self.assertEqual(
            nodes["beta-note"]["backlinks"],
            [{"source": "alpha-note", "type": "related_to"}],
        )
        self.assertEqual(nodes["beta-note"]["related_notes"], ["alpha-note"])

    def test_accepts_relationless_approved_note(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self.write_public_note(root, "only.md", synthetic_note("only-note"))
            payload = build_payload(self.source(root))
        self.assertEqual(len(payload["nodes"]), 1)
        self.assertEqual(payload["edges"], [])
        self.assertEqual(payload["nodes"][0]["backlinks"], [])
        self.assertEqual(payload["nodes"][0]["related_notes"], [])

    def test_supports_multiple_relation_types(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self.write_public_note(root, "b.md", synthetic_note("beta-note"))
            self.write_public_note(root, "c.md", synthetic_note("gamma-note"))
            self.write_public_note(
                root,
                "a.md",
                synthetic_note(
                    "alpha-note",
                    relations=[("gamma-note", "uses"), ("beta-note", "builds_on")],
                ),
            )
            payload = build_payload(self.source(root))
        self.assertEqual([edge["type"] for edge in payload["edges"]], ["builds_on", "uses"])
        nodes = {node["id"]: node for node in payload["nodes"]}
        self.assertEqual(nodes["alpha-note"]["related_notes"], [])
        self.assertEqual(nodes["beta-note"]["backlinks"], [{"source": "alpha-note", "type": "builds_on"}])
        self.assertEqual(nodes["gamma-note"]["backlinks"], [{"source": "alpha-note", "type": "uses"}])

    def test_output_is_stable_when_file_and_relation_order_changes(self) -> None:
        with tempfile.TemporaryDirectory() as first_dir, tempfile.TemporaryDirectory() as second_dir:
            first, second = Path(first_dir), Path(second_dir)
            for root, source_name, relations in (
                (first, "z.md", [("gamma-note", "uses"), ("beta-note", "related_to")]),
                (second, "a.md", [("beta-note", "related_to"), ("gamma-note", "uses")]),
            ):
                self.write_public_note(root, source_name, synthetic_note("alpha-note", relations=relations))
                self.write_public_note(root, "target-b.md", synthetic_note("beta-note"))
                self.write_public_note(root, "target-c.md", synthetic_note("gamma-note"))
            first_payload = render_payload(build_payload(self.source(first)))
            second_payload = render_payload(build_payload(self.source(second)))
        self.assertEqual(first_payload, second_payload)

    def test_check_accepts_current_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self.write_public_note(root, "only.md", synthetic_note("only-note"))
            index = self.write_current_index(root)
            output = root / "content" / "public" / "graph.json"
            arguments = ["--source", str(self.source(root)), "--index", str(index), "--output", str(output)]
            self.assertEqual(main(arguments), 0)
            self.assertEqual(main([*arguments, "--check"]), 0)

    def test_rejects_missing_or_empty_relation_fields(self) -> None:
        cases = {
            "target_is_required": [(None, "supports")],
            "type_is_required": [("beta-note", None)],
            "target_must_not_be_empty": [("", "supports")],
        }
        for expected_rule, relations in cases.items():
            with self.subTest(expected_rule), tempfile.TemporaryDirectory() as temp_dir:
                root = Path(temp_dir)
                self.write_public_note(root, "b.md", synthetic_note("beta-note"))
                self.write_public_note(root, "a.md", synthetic_note("alpha-note", relations=relations))
                with self.assertRaises(ValueError) as context:
                    build_payload(self.source(root))
                self.assertIn(expected_rule, str(context.exception))

    def test_rejects_unknown_target(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self.write_public_note(
                root,
                "a.md",
                synthetic_note("alpha-note", relations=[("missing-note", "related_to")]),
            )
            with self.assertRaisesRegex(ValueError, "target_not_found"):
                build_payload(self.source(root))

    def test_rejects_self_relation(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self.write_public_note(
                root,
                "a.md",
                synthetic_note("alpha-note", relations=[("alpha-note", "related_to")]),
            )
            with self.assertRaisesRegex(ValueError, "self_relation_not_allowed"):
                build_payload(self.source(root))

    def test_rejects_unsupported_relation_type(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self.write_public_note(root, "b.md", synthetic_note("beta-note"))
            self.write_public_note(
                root,
                "a.md",
                synthetic_note("alpha-note", relations=[("beta-note", "inferred_from")]),
            )
            with self.assertRaisesRegex(ValueError, "relation_type_not_allowed"):
                build_payload(self.source(root))

    def test_rejects_duplicate_edge(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self.write_public_note(root, "b.md", synthetic_note("beta-note"))
            self.write_public_note(
                root,
                "a.md",
                synthetic_note(
                    "alpha-note",
                    relations=[("beta-note", "related_to"), ("beta-note", "related_to")],
                ),
            )
            with self.assertRaisesRegex(ValueError, "duplicate_source_target_type"):
                build_payload(self.source(root))

    def test_rejects_duplicate_node_id(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self.write_public_note(root, "first.md", synthetic_note("same-note"))
            self.write_public_note(root, "second.md", synthetic_note("same-note"))
            with self.assertRaisesRegex(ValueError, "duplicate note id"):
                build_payload(self.source(root))

    def test_rejects_draft_or_review_target(self) -> None:
        for state in ("draft", "review"):
            with self.subTest(state), tempfile.TemporaryDirectory() as temp_dir:
                root = Path(temp_dir)
                self.write_public_note(root, "b.md", synthetic_note("beta-note", state=state))
                self.write_public_note(
                    root,
                    "a.md",
                    synthetic_note("alpha-note", relations=[("beta-note", "supports")]),
                )
                with self.assertRaisesRegex(ValueError, "target_must_be_approved_or_published"):
                    build_payload(self.source(root))

    def test_rejects_private_or_local_identifier_without_consuming_private_vault(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            private_path = root / "vaults" / "CORCOIDUM-Core" / "10_Learning" / "private.md"
            private_path.parent.mkdir(parents=True)
            private_path.write_text(PRIVATE_NOTE, encoding="utf-8")
            self.write_public_note(
                root,
                "a.md",
                synthetic_note("alpha-note", relations=[("private-local-note", "uses")]),
            )
            with self.assertRaisesRegex(ValueError, "target_not_found"):
                build_payload(self.source(root))

    def test_check_rejects_stale_artifact_and_stale_public_index(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self.write_public_note(root, "only.md", synthetic_note("only-note"))
            index = self.write_current_index(root)
            output = root / "content" / "public" / "graph.json"
            arguments = ["--source", str(self.source(root)), "--index", str(index), "--output", str(output)]
            self.assertEqual(main(arguments), 0)

            payload = json.loads(output.read_text(encoding="utf-8"))
            payload["nodes"][0]["label"] = "Stale label"
            output.write_text(render_payload(payload), encoding="utf-8")
            self.assertEqual(main([*arguments, "--check"]), 1)

            self.write_public_note(root, "new.md", synthetic_note("new-note"))
            self.assertEqual(main(arguments), 1)

    def test_rejects_invalid_graph_schema(self) -> None:
        invalid = {"version": 2, "nodes": "not-an-array", "edges": []}
        with self.assertRaisesRegex(ValueError, "nodes and edges must be arrays"):
            validate_graph_payload(invalid)

    def test_rejects_duplicate_id_inside_generated_graph(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self.write_public_note(root, "only.md", synthetic_note("only-note"))
            payload = build_payload(self.source(root))
        payload["nodes"].append(dict(payload["nodes"][0]))
        with self.assertRaisesRegex(ValueError, "duplicate graph node id"):
            validate_graph_payload(payload)

    def test_rejects_generated_node_outside_approved_source(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self.write_public_note(root, "only.md", synthetic_note("only-note"))
            payload = build_payload(self.source(root))
        extra_node = {
            **payload["nodes"][0],
            "id": "private-note",
            "label": "Unexpected node",
            "url": "/garden?note=private-note",
        }
        payload["nodes"].append(extra_node)
        with self.assertRaisesRegex(ValueError, "do not match the approved public source"):
            validate_graph_payload(payload, {"only-note"})

    def test_rejects_node_url_that_does_not_match_its_id(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self.write_public_note(root, "only.md", synthetic_note("only-note"))
            payload = build_payload(self.source(root))
        payload["nodes"][0]["url"] = "/garden?note=another-note"
        with self.assertRaisesRegex(ValueError, "url must match its public note id"):
            validate_graph_payload(payload)

    def test_rejects_backlinks_that_do_not_match_edges(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self.write_public_note(root, "b.md", synthetic_note("beta-note"))
            self.write_public_note(
                root,
                "a.md",
                synthetic_note("alpha-note", relations=[("beta-note", "supports")]),
            )
            payload = build_payload(self.source(root))
        beta_node = next(node for node in payload["nodes"] if node["id"] == "beta-note")
        beta_node["backlinks"] = []
        with self.assertRaisesRegex(ValueError, "backlinks do not match graph edges"):
            validate_graph_payload(payload)

    def test_rejects_related_notes_that_do_not_match_related_to_edges(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            self.write_public_note(root, "b.md", synthetic_note("beta-note"))
            self.write_public_note(root, "a.md", synthetic_note("alpha-note"))
            payload = build_payload(self.source(root))
        alpha_node = next(node for node in payload["nodes"] if node["id"] == "alpha-note")
        alpha_node["related_notes"] = ["beta-note"]
        with self.assertRaisesRegex(ValueError, "related_notes do not match related_to edges"):
            validate_graph_payload(payload)


if __name__ == "__main__":
    unittest.main()
