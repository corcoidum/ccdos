---
id: only-reviewed-relations-become-graph
title: 사람이 확인한 관계만 그래프가 된다
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
  - trust
  - knowledge-graph
  - governance
relations:
  - target: empty-garden-is-a-promise
    type: builds_on
---

공개 기록 열 편을 처음 graph로 연결할 때, tag가 비슷한 글을 자동으로 묶거나 LLM에게 관계를 추측하게 하지 않았다. 실제로 저장한 것은 사람이 frontmatter에서 선언하고 다시 검토한 네 개의 edge뿐이었다. 관계가 없는 노드는 그대로 남겼고, 빈칸을 그럴듯한 연결로 채우지 않았다.

Builder는 승인된 공개 노트만 node로 만든다. Draft나 review 상태, 존재하지 않는 target, 자기 자신을 가리키는 관계, 중복 edge는 graph에 들어가기 전에 차단된다. Backlinks는 검증된 edge의 역방향 조회 목록으로 계산하고, Related Notes는 의미가 양방향인 `related_to`에만 만든다. 방향을 가진 관계를 편의를 위해 뒤집지 않는다.

생성물에는 실행 시각도 넣지 않았다. 같은 Markdown 입력은 byte 단위로 같은 `graph.json`을 만들고, `--check`는 schema뿐 아니라 현재 승인 집합과의 일치 여부까지 검사한다. 관계의 원본은 계속 Markdown과 git history에 남고, JSON은 언제든 다시 만들 수 있는 read model일 뿐이다.

신뢰할 수 있는 graph는 연결이 많은 graph가 아니었다. 누가 선언했고 어떤 검토를 통과했는지 설명할 수 있으며, 같은 입력에서 같은 결과를 다시 얻을 수 있는 graph였다. 모르는 관계를 비워 두는 선택까지 재현 가능하게 만든 것이 이 작업의 실제 성과다.
