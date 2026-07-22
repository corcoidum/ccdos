---
id: one-link-less-explanation
title: 한 번 더 찾지 않게 하는 링크
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
  - mercy
  - navigation
  - accessibility
relations:
  - target: safe-automation-case-study
    type: demonstrates
---

공개 Garden의 기록을 누군가에게 알려 주려면 예전에는 첫 화면을 연 뒤 tag를 고르고 제목을 다시 찾으라고 설명해야 했다. 글은 공개되어 있었지만, 정확한 글까지 가는 경로는 함께 건넬 수 없었다. 기록이 늘수록 이 작은 안내가 계속 반복될 구조였다.

각 graph node에 `/garden?note=<id>` 형식의 URL을 만들고, 그 주소로 들어오면 해당 글의 전문 modal이 바로 열리게 했다. Card에서 글을 열 때도 같은 query를 browser history에 남겨 뒤로가기로 modal과 URL이 함께 닫힌다. 존재하지 않는 ID는 빈 modal이나 오류를 보여 주지 않고 query만 조용히 제거한다.

연결된 기록도 modal 안에서 바로 이동할 수 있게 했다. 이동 뒤에는 새 제목으로 keyboard focus를 넘기고, modal을 닫으면 원래 열었던 control로 focus를 돌려준다. Direct access, 뒤로가기, 잘못된 ID, relation 이동, focus 복귀를 browser test로 확인했다.

사람의 부담은 거대한 업무에서만 생기지 않는다. "어디에서 무엇을 눌러야 하나요"를 매번 다시 설명하고, 같은 기록을 다시 찾는 작은 마찰도 쌓인다. 링크 하나가 그 안내를 대신하고 사용자가 자기 흐름을 잃지 않게 만든 것, 그것이 이 navigation 작업에서 줄인 실제 부담이다.
