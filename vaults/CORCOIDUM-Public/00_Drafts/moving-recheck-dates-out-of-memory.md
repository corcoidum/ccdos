---
id: moving-recheck-dates-out-of-memory
title: 재검일을 사람의 기억에서 꺼내는 법
created: 2026-07-26T14:43:32Z
updated: 2026-07-26T14:43:32Z
classification: S0_PUBLIC
visibility: public
publish_state: published
review_requested_at: 2026-07-26T14:50:22Z
privacy_reviewed_by: corcoidum
privacy_reviewed_at: 2026-07-26T14:50:22Z
privacy_review_result: passed
reviewed_revision: 2026-07-26T14:43:32Z
approved_by: corcoidum
approved_at: 2026-07-26T14:50:22Z
published_at: 2026-07-26T14:53:48Z
tags:
  - mercy
  - hope
  - healthcare-ops
  - automation
  - project-log
relations:
  - target: when-automation-creates-new-work
    type: builds_on
  - target: safe-automation-case-study
    type: builds_on
---

의원 원무에서 재검 업무는 종종 사람의 기억으로 완성된다. 예정일을 적어 둔 대장이 있어도 오늘 다시 확인해야 할 대상을 찾고, 연락하지 못한 이유를 기억하고, 다음 사람이 이어서 처리할 수 있게 설명하는 일은 결국 누군가의 머릿속에 남는다. 사람이 꼼꼼해서 유지되는 workflow는 그 사람이 바쁘거나 자리를 비우는 순간 가장 약해진다.

그래서 작은 프로젝트를 시작하려 한다. **재검일을 사람의 기억에서 꺼내, 상태와 이력이 남는 업무 목록으로 옮기는 것.** 거대한 병원 시스템을 만들려는 것이 아니라, 오늘 확인할 일과 아직 끝나지 않은 이유를 놓치지 않게 하는 Python 기반의 작은 운영 도구를 만드는 일이다.

첫 번째 prototype은 실제 환자정보를 사용하지 않는다. 이름, 연락처, 차트번호, 진료 내용 없이 synthetic data만 사용한다. 입력은 임의의 업무 ID, 예정일, 진행 상태, 마지막 처리 시각과 예외 사유로 제한한다. 예정일이 되었지만 완료되지 않은 항목을 찾고, 연락 대기·확인 필요·보류처럼 다음 행동이 필요한 상태를 구분해 하루의 확인 목록으로 보여 줄 계획이다.

도구가 대신 판단하지 않는 경계도 먼저 정한다. 이 시스템은 진단, 치료, 재검 필요성이나 우선순위를 결정하지 않는다. 의료진이 이미 정한 운영상 후속 업무를 정리하고, 누락 가능성을 보여 주는 역할만 맡는다. 상태를 완료하거나 보류하는 최종 결정은 사람에게 남기고, 수동으로 수정할 수 있어야 한다.

자동화가 새로운 확인 업무를 만들 수 있다는 점도 설계에 포함한다. 상태가 바뀔 때마다 변경 전후 값과 시각을 audit log에 남기고, 처리할 수 없는 항목은 숨기지 않고 exception으로 분리한다. 자동화가 멈춰도 CSV 목록으로 돌아가 업무를 이어갈 수 있는 fallback을 두고, 재실행해도 같은 항목이 중복 처리되지 않게 만들 생각이다.

이 프로젝트의 성공을 화면의 화려함이나 기능 수로 판단하지 않으려 한다. 다음 네 질문에 짧게 답할 수 있으면 첫 단계는 성공이다.

- 오늘 다시 확인해야 할 업무는 무엇인가.
- 이 업무는 왜 아직 남아 있는가.
- 누가 언제 상태를 바꾸었는가.
- 자동화가 멈추면 어떻게 수동으로 이어갈 수 있는가.

첫 구현은 작은 data model, synthetic fixture, 예정일 검사와 변경 이력부터 시작한다. 그다음에야 dashboard, 알림, 검색을 검토한다. 실제 필요가 확인되기 전에 기능을 늘리지 않고, 실제 환자정보를 외부 서비스나 이 저장소에 올리지 않는다.

이 글은 완성 보고서가 아니다. 현장에서 오래 사람의 기억에 얹혀 있던 일을, 사람이 기억하지 않아도 책임 있게 이어갈 수 있는 구조로 바꾸어 보겠다는 시작 기록이다.
