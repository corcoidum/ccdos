---
id: search-that-does-not-guess
title: 추측하지 않는 검색
created: 2026-07-13T08:54:00Z
updated: 2026-07-13T08:54:00Z
classification: S0_PUBLIC
visibility: public
publish_state: approved
review_requested_at: 2026-07-13T08:56:00Z
privacy_reviewed_by: corcoidum
privacy_reviewed_at: 2026-07-13T08:57:52Z
privacy_review_result: passed
reviewed_revision: 2026-07-13T08:54:00Z
approved_by: corcoidum
approved_at: 2026-07-13T08:57:52Z
tags:
  - retrieval
  - automation
---

공개 위키 검색의 첫 버전은 답변을 생성하지 않는다. 승인된 공개 기록만 검색해서, 어느 문서의 어느 부분이 질문과 닿아 있는지 출처와 발췌로만 보여 준다. 일치하는 승인 문서가 없으면 없다고 말한다.

외부 LLM을 연결하는 일은 의도적으로 미뤘다. 어떤 provider를 쓸지, 비용은 어떻게 감당할지, 무엇보다 어떤 데이터가 외부로 나가도 되는지의 경계가 결정되지 않았기 때문이다. 결정 전에 연결부터 하면, 경계는 나중에 그리기 어렵다.

아직 연결하지 않기로 한 것도 아키텍처 결정이다. 이 시스템에서는 그 결정도 같은 무게로 기록된다.
