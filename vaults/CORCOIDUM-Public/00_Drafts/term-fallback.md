---
id: term-fallback
title: 폴백
created: 2026-07-25T23:05:00Z
updated: 2026-07-25T23:05:00Z
classification: S0_PUBLIC
visibility: public
publish_state: published
review_requested_at: 2026-07-26T01:53:11Z
privacy_reviewed_by: corcoidum
privacy_reviewed_at: 2026-07-26T01:53:12Z
privacy_review_result: passed
reviewed_revision: 2026-07-25T23:05:00Z
approved_by: corcoidum
approved_at: 2026-07-26T01:53:13Z
published_at: 2026-07-26T02:02:19Z
note_kind: glossary
aliases:
  - 폴백
tags:
  - glossary
  - reliability
---

기능이 실패했을 때 오류 대신 미리 정해 둔 대체 동작을 보여 주는 설계다. 이 저장소에서는 답변 생성이 실패하면 승인된 근거 목록만 대신 보여 준다.

폴백은 사용자를 지켜 주지만 운영자의 눈도 가린다. 정상 동작과 폴백 상태를 구분하지 않으면 멈춘 기능이 정상으로 보인 채 오래 남는다. 그래서 폴백을 만들 때는 폴백이 작동 중이라는 사실 자체를 감지하는 검사를 함께 둔다.
