"""가치 이름은 머리글자 하나와 나머지 낱말로 적는다: H.OPE · T.RUST · M.ERCY · L.OVE."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEGACY_NOTATION = re.compile(r"H\.O\.P\.E|T\.R\.U\.S\.T|M\.E\.R\.C\.Y|L\.O\.V\.E")

# 사이트 화면 문구와 살아 있는 계획 문서만 검사한다. design-qa.md와 통합 원페이지는 표기를
# 바꾸기 전 상태를 담은 증적이고, 발행된 노트 본문은 승인 증적 때문에 재검토 없이 고치지 않는다.
SCAN_TARGETS = [
    *(ROOT / "site" / "src").glob("*.ts"),
    *(ROOT / "docs" / "architecture").glob("phase-*-plan.md"),
]


class ValueNotationTests(unittest.TestCase):
    def test_scan_targets_exist(self) -> None:
        self.assertTrue(SCAN_TARGETS, "검사할 파일을 찾지 못했습니다.")

    def test_no_legacy_value_notation(self) -> None:
        offenders: list[str] = []
        for path in SCAN_TARGETS:
            text = path.read_text(encoding="utf-8")
            for number, line in enumerate(text.splitlines(), start=1):
                if LEGACY_NOTATION.search(line):
                    offenders.append(f"{path.relative_to(ROOT).as_posix()}:{number}")
        self.assertEqual(
            offenders,
            [],
            "가치 이름을 H.OPE · T.RUST · M.ERCY · L.OVE 형식으로 바꾸세요: " + ", ".join(offenders),
        )


if __name__ == "__main__":
    unittest.main()
