---
id: discord-webhook-403-lesson
title: 403은 항상 권한 문제가 아니다
created: 2026-07-13T08:54:00Z
updated: 2026-07-14T09:12:12Z
classification: S0_PUBLIC
visibility: public
publish_state: published
review_requested_at: 2026-07-14T09:12:12Z
privacy_reviewed_by: corcoidum
privacy_reviewed_at: 2026-07-14T09:12:12Z
privacy_review_result: passed
reviewed_revision: 2026-07-14T09:12:12Z
approved_by: corcoidum
approved_at: 2026-07-14T09:12:12Z
published_at: 2026-07-14T09:14:52Z
tags:
  - trust
  - automation
  - debugging
---

배포 알림을 Discord webhook으로 보내는 단계가 계속 403으로 실패했다. 첫 번째 의심은 당연히 webhook 주소가 잘못 등록되었다는 것이었고, 값을 다시 발급해 등록해도 결과는 같았다.

실제 원인은 전혀 다른 층에 있었다. Discord의 edge가 Python 표준 라이브러리의 기본 User-Agent를 차단하고 있었다. 요청에 이 자동화의 이름을 밝힌 User-Agent 헤더를 붙이자 같은 주소, 같은 값으로 바로 성공했다.

에러 코드는 원인이 아니라 분류를 알려줄 뿐이다. 403을 보고 비밀값부터 교체하기 전에, 실패한 층이 어디인지 먼저 읽어야 한다. 이 사건 이후로 "의심보다 관찰"은 이 시스템의 디버깅 원칙이 되었다.
