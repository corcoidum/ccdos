"""Phase 0의 최소 아키텍처 불변식을 검사한다. 외부 의존성은 없다."""

from __future__ import annotations

import json
import sys
from pathlib import Path

REQUIRED_COMPONENTS = {
    "clinicops_local",
    "corcoidum_core",
    "corcoidum_public",
    "github",
    "discord",
    "openkiki_org",
    "rag_mvp",
    "grounded_answer_layer",
    "openai_api",
}
REQUIRED_DOCUMENTS = {
    "docs/architecture/charter.md",
    "docs/governance/source-of-truth.md",
    "docs/governance/security-classification.md",
    "docs/governance/content-lifecycle.md",
    "docs/governance/sync-backup-policy.md",
    "docs/adr/0001-small-maintainable-stack.md",
    "docs/architecture/risk-register.md",
}


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    missing_docs = sorted(path for path in REQUIRED_DOCUMENTS if not (root / path).is_file())
    if missing_docs:
        print("FAIL: missing required documents: " + ", ".join(missing_docs))
        return 1

    model = json.loads((root / "docs/architecture/architecture-model.json").read_text(encoding="utf-8"))
    components = {component["id"]: component for component in model["components"]}
    missing_components = REQUIRED_COMPONENTS - components.keys()
    if missing_components:
        print("FAIL: components without an owner: " + ", ".join(sorted(missing_components)))
        return 1
    if any(not component.get("owner") for component in components.values()):
        print("FAIL: at least one component has no owner")
        return 1

    restricted_ids = {
        component["id"] for component in components.values()
        if component.get("security_level") == "S3_RESTRICTED"
    }
    external_ids = {component["id"] for component in components.values() if component.get("external")}
    violations = [
        f"{flow['from']} -> {flow['to']}"
        for flow in model["flows"]
        if flow["from"] in restricted_ids and flow["to"] in external_ids
    ]
    if violations:
        print("FAIL: restricted external data flow found: " + ", ".join(violations))
        return 1

    print("PASS: Phase 0 ownership and restricted-data boundaries are valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
