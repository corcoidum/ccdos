---
id: graceful-fallback-hid-the-outage
title: 잘 만든 폴백이 장애를 숨겼다
created: 2026-07-22T10:46:39Z
updated: 2026-07-22T10:46:39Z
classification: S0_PUBLIC
visibility: public
publish_state: published
review_requested_at: 2026-07-22T10:50:08Z
privacy_reviewed_by: corcoidum
privacy_reviewed_at: 2026-07-22T10:50:09Z
privacy_review_result: passed
reviewed_revision: 2026-07-22T10:46:39Z
approved_by: corcoidum
approved_at: 2026-07-22T10:50:10Z
published_at: 2026-07-22T10:54:24Z
tags:
  - trust
  - automation
  - debugging
relations:
  - target: discord-webhook-403-lesson
    type: builds_on
  - target: search-that-does-not-guess
    type: related_to
---

공개 위키의 답변 생성 계층이 한동안 동작하지 않고 있었다. 그런데 사이트는 멀쩡해 보였다. 생성에 실패하면 승인된 근거 목록을 대신 보여 주도록 설계해 두었기 때문이다. 방문자는 언제나 쓸 만한 화면을 받았고, 배포 검사도 초록불이었다. 근거만 보여 주는 상태와 생성까지 성공한 상태를 아무도 구분하지 않았으므로, 멈춘 기능은 조용히 몇 주를 흘렀다.

원인을 찾는 과정은 더 부끄러웠다. 실패는 403이었고, 나는 그 숫자만 보고 세 번을 헛짚었다. 요청 이름을 밝히면 되겠지, 실행 위치를 최적화하면 되겠지, 여러 번 시도하면 되겠지. 세 번 모두 배포하고 세 번 모두 빗나갔다. 그러다 응답 본문을 읽었고, 거기에는 처음부터 이유가 한 줄로 적혀 있었다. 지원하지 않는 지역에서 온 요청이라는 것이었다. 서버가 방문자와 가까운 곳에서 실행되다 보니 외부로 나가는 위치가 매번 달라졌고, 그중 일부가 거절당하고 있었다. 호출이 항상 같은 지역에서 나가도록 고정하자 열 번 중 열 번이 성공했다.

두 가지를 배웠다. 하나는 우아한 폴백이 사용자를 지켜 주는 만큼 운영자의 눈도 가린다는 것이다. 그래서 이제 배포 뒤에 실제로 답변이 생성되는지 확인하고, 정상적인 폴백과 고장 난 폴백을 구분해 실패로 처리하는 검사를 두었다. 다른 하나는 에러 코드가 분류일 뿐이라는 오래된 교훈이 아직 절반이었다는 것이다. 분류를 읽은 다음에는, 상대가 이미 적어 둔 이유를 읽어야 한다. 추측을 배포하는 것보다 본문을 한 번 읽는 쪽이 언제나 빨랐다.
