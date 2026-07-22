"""Verify the deployed answer-layer smoke check separates healthy from broken."""

from __future__ import annotations

import unittest

from automation.check_answer_layer import evaluate


class EvaluateAnswerPayloadTest(unittest.TestCase):
    def test_generated_answer_passes(self) -> None:
        code, summary = evaluate({"mode": "generated", "sources": [{"id": "a"}, {"id": "b"}]})
        self.assertEqual(code, 0)
        self.assertIn("2 approved source", summary)

    def test_throttled_fallback_is_healthy(self) -> None:
        for reason in ("rate_limited", "budget_exhausted"):
            with self.subTest(reason=reason):
                code, summary = evaluate({"mode": "retrieval", "reason": reason, "sources": []})
                self.assertEqual(code, 0)
                self.assertIn("throttled", summary)

    def test_misconfigured_fallback_fails(self) -> None:
        for reason in ("not_configured", "provider_error", "infrastructure_error"):
            with self.subTest(reason=reason):
                code, _ = evaluate({"mode": "retrieval", "reason": reason, "sources": []})
                self.assertEqual(code, 1)

    def test_failure_reports_diagnostic_when_present(self) -> None:
        code, summary = evaluate(
            {"mode": "retrieval", "reason": "provider_error", "diagnostic": "http_404", "sources": []}
        )
        self.assertEqual(code, 1)
        self.assertIn("http_404", summary)

    def test_safety_gate_rejection_warns_without_failing(self) -> None:
        code, summary = evaluate({"mode": "retrieval", "reason": "invalid_citations", "sources": []})
        self.assertEqual(code, 0)
        self.assertIn("WARN", summary)

    def test_query_without_evidence_fails_as_a_bad_smoke_query(self) -> None:
        code, _ = evaluate({"mode": "retrieval", "reason": "no_sources", "sources": []})
        self.assertEqual(code, 1)

    def test_unexpected_payload_fails(self) -> None:
        code, _ = evaluate({"mode": "retrieval", "reason": "brand_new_reason", "sources": []})
        self.assertEqual(code, 1)


if __name__ == "__main__":
    unittest.main()
