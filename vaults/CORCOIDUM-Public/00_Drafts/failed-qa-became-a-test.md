---
id: failed-qa-became-a-test
title: 실패한 검토를 테스트로 바꾸다
created: 2026-07-22T00:09:24Z
updated: 2026-07-22T00:09:24Z
classification: S0_PUBLIC
visibility: public
publish_state: approved
review_requested_at: 2026-07-22T00:11:05Z
privacy_reviewed_by: corcoidum
privacy_reviewed_at: 2026-07-22T00:11:34Z
privacy_review_result: passed
reviewed_revision: 2026-07-22T00:09:24Z
approved_by: corcoidum
approved_at: 2026-07-22T00:11:35Z
tags:
  - hope
  - learning
  - design-qa
relations:
  - target: doubt-into-a-ladder
    type: demonstrates
---

사이트의 화면 폭을 정리한 첫 visual QA는 통과가 아니라 차단으로 끝났다. Header, hero, 본문이 서로 다른 폭 규칙을 쓰고 있었고, tablet에서는 제목이 지나치게 여러 줄로 꺾였다. 같은 페이지 안의 CTA는 목적지까지 스크롤했지만 keyboard focus를 넘기지 않아, 키보드 사용자는 이동 결과를 바로 알기 어려웠다.

"어딘가 어색하다"는 느낌을 그대로 두지 않았다. Desktop, tablet, mobile에서 각 영역의 좌우 위치와 너비를 재고, 화면을 비교 증적으로 남겼다. 하나의 `--shell-width`가 header부터 footer까지 같은 정렬선을 맡게 했고, hero가 한 열로 바뀌는 지점을 1100px로 앞당겼다. Hash navigation에는 스크롤뿐 아니라 focus 이동도 함께 넣었다.

수정 뒤에는 네 route와 세 viewport의 geometry, CTA의 URL·scroll offset·focus를 Playwright test로 고정했다. TypeScript 검사와 production build, 당시의 browser test 15개도 모두 통과했다. 처음 발견한 문제는 숨기지 않고 `design-qa.md`의 첫 pass에 남겼다.

다시 배우는 과정에서 실패 판정은 실력이 없다는 결론이 아니었다. 모호했던 차이를 재현 가능한 조건으로 바꾸라는 신호였다. 한 번 막힌 검토가 다음 수정을 지켜 주는 테스트가 되었을 때, 실패는 작업을 멈추는 벽이 아니라 다음 계단이 되었다.
