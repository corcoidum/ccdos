---
id: from-working-site-to-trustworthy-system
title: 작동하는 사이트에서 신뢰할 수 있는 시스템으로
created: 2026-07-13T20:46:31Z
updated: 2026-07-13T20:46:31Z
classification: S0_PUBLIC
visibility: public
publish_state: approved
review_requested_at: 2026-07-13T20:46:54Z
privacy_reviewed_by: corcoidum
privacy_reviewed_at: 2026-07-13T20:47:01Z
privacy_review_result: passed
reviewed_revision: 2026-07-13T20:46:31Z
approved_by: corcoidum
approved_at: 2026-07-13T20:47:01Z
tags:
  - reliability
  - automation
  - openai
  - case-study
---

오늘 CCDOS에서 한 일은 새로운 화면 하나를 더 만드는 일이 아니었다. 이미 작동하는 사이트가 사람의 실수와 외부 서비스의 실패 앞에서도 약속을 지키도록, 보이지 않는 경계를 촘촘하게 만드는 일이었다.

공개 파이프라인은 같은 ID를 가진 기록이 두 번 들어오거나 승인보다 이른 시각에 게시되는 모순을 차단하게 되었다. 배포가 실패해도 상태 보고와 알림이 함께 사라지지 않도록 실패 경로도 분리했다. 성공할 때만 작동하는 자동화가 아니라, 실패했을 때 무엇이 일어났는지 남기는 자동화에 가까워졌다.

Garden은 처음 두 개의 기록에 집중하고 나머지는 독자가 원할 때 펼쳐볼 수 있게 바뀌었다. 페이지 이동 gesture도 모바일 touch와 노트북 trackpad를 같은 입력으로 추측하지 않고 각각 처리한다. 수평 이동 거리, 세로 스크롤과의 비율, 연속 입력의 간격을 판단해 브라우저의 뒤로 가기 동작과 페이지 navigation이 경쟁하던 문제를 줄였다.

공개 지식에 답하는 AI 계층도 OpenAI Responses API로 연결했다. 모델에는 방문자의 질문과 사람이 승인한 공개 발췌만 전달하고, 허용된 출처 ID를 인용하지 않은 답변은 보여주지 않는다. 호출 한도나 provider 오류가 생기면 검색 결과만 보여주는 방식으로 돌아간다. AI가 항상 답하게 만드는 것보다, 답해도 되는 조건을 먼저 코드로 고정했다.

마지막에는 Python 검증, browser smoke test, typecheck와 production build를 자동 배포 앞에 세웠다. 오늘의 결과는 기능의 개수보다 실패가 조용히 지나갈 수 있는 길이 줄었다는 데 있다. 신뢰는 한 번의 선언으로 생기지 않고, 시스템이 반복해서 지키는 작은 거절과 기록으로 자란다.
