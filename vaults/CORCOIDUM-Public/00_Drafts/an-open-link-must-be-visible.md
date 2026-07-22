---
id: an-open-link-must-be-visible
title: 열린 링크도 보이지 않으면 닫힌 것과 같다
created: 2026-07-22T16:33:24Z
updated: 2026-07-22T16:33:24Z
classification: S0_PUBLIC
visibility: public
publish_state: approved
review_requested_at: 2026-07-22T16:38:04Z
privacy_reviewed_by: corcoidum
privacy_reviewed_at: 2026-07-22T16:38:04Z
privacy_review_result: passed
reviewed_revision: 2026-07-22T16:33:24Z
approved_by: corcoidum
approved_at: 2026-07-22T16:38:04Z
tags:
  - mercy
  - accessibility
  - navigation
  - design-qa
relations:
  - target: one-link-less-explanation
    type: builds_on
---

Projects의 Phase마다 목적, 구현, 안전 경계와 검증 증거를 읽을 수 있는 상세 화면을 만들었다. 각 단계가 무엇을 했는지 설명하는 것만으로는 부족해 완료 보고서와 기준 문서로 이어지는 링크도 함께 두었다. Desktop에서는 자연스러워 보였지만, mobile에서 링크를 누르면 아무 일도 일어나지 않은 것처럼 느껴졌다.

파일이 없거나 배포가 실패한 것은 아니었다. 링크는 새 탭을 열었고 GitHub의 보고서 본문도 정상적으로 존재했다. 문제는 mobile과 인앱 브라우저에서 새 탭이 배경에 숨을 수 있다는 점이었다. 현재 화면은 그대로이고 이동했다는 피드백도 없으니, 기술적으로 열린 링크가 사용자에게는 닫힌 링크와 같았다.

원문을 열기 전에도 증거의 의미를 알 수 있도록 Phase 상세 화면에 문서명, 짧은 검증 요약과 출처를 먼저 표시했다. 증거 링크만은 현재 탭으로 이동하게 하고, browser Back으로 원래 Phase 상세 화면이 복원되도록 했다. 다른 외부 링크의 동작은 바꾸지 않았고, 새로운 Markdown renderer나 dependency도 추가하지 않았다.

수정 뒤에는 모든 Phase의 evidence metadata, 같은 탭 이동, 추가 탭이 생기지 않는 조건, 뒤로가기 복원, 44px touch target과 가로 overflow를 browser test로 고정했다. Architecture와 privacy gate, public content와 graph 검사, Python test, TypeScript build와 40개의 browser test를 통과한 뒤 production에서도 같은 흐름을 다시 확인했다.

기능이 작동한다는 사실과 사람이 작동했다고 이해하는 경험은 다르다. 사용자가 결과를 찾기 위해 탭 목록이나 긴 외부 화면을 다시 탐색해야 한다면, 시스템은 자신의 상태를 충분히 설명하지 못한 것이다. 이번 작업은 링크 하나를 바꾼 일이 아니라, 증거로 가는 길도 증거만큼 분명해야 한다는 원칙을 인터페이스와 테스트에 남긴 일이었다.
