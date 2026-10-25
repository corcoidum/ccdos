---
id: coriops-nexus-development-review-2026-10-25
title: CoriOps Nexus 개발 리뷰 — 현장 장부에서 검증 가능한 운영 시스템으로
created: 2026-10-25T12:02:29Z
updated: 2026-10-25T12:02:29Z
classification: S0_PUBLIC
visibility: public
publish_state: published
review_requested_at: 2026-10-25T12:08:38Z
privacy_reviewed_by: corcoidum
privacy_reviewed_at: 2026-10-25T12:08:38Z
privacy_review_result: passed
reviewed_revision: 2026-10-25T12:02:29Z
approved_by: corcoidum
approved_at: 2026-10-25T12:08:38Z
published_at: 2026-10-25T12:15:16Z
tags:
  - trust
  - mercy
  - healthcare-ops
  - project-review
---

CoriOps Nexus는 내시경·조직검체 장부에서 시작해, 후속 업무를 놓치지 않도록 돕는 원내 운영 시스템으로 발전하고 있다. 현재 개발 과정을 평가하면 **업무 문제를 구체화하고 검증 가능한 코드로 옮기는 방향은 좋다. 다음 단계의 핵심은 공통 데이터 모델 이전과 실패 복구이며, 실데이터 운영 준비는 별도로 남아 있다.**

이 글은 2026년 10월 25일 공개 저장소의 `main`, 커밋 `f59793d`를 고정해 검토한 기록이다. README와 ROADMAP, 결정 기록, 구현 코드, 테스트, GitHub Actions 실행 결과를 대조했다. 별도 Docker 환경에서 Python 3.12와 PostgreSQL 16으로 시험했으며 실제 환자 자료는 사용하지 않았다. 개발 품질에 대한 평가이며, 의료적 타당성이나 법적 적합성을 인증하는 글은 아니다.

## 1. 시작점이 구체적이다

이 프로젝트가 다루는 문제는 검체 접수, 인계, 결과 도착, 원장 지시, 재검 일정이 서로 다른 기록과 사람의 기억에 흩어져 있다는 것이다. 그래서 첫 구현도 합성 장부와 수동 입력 화면이었다. 외부 결과 포털 자동 로그인과 자동 변환은 보류하고, 사람이 실제 흐름을 눌러볼 수 있는 화면부터 만들었다.

이후 업무를 다시 확인하면서 설계도 바뀌었다. 인계 과정에서는 접수인·인계인·인수인과 병 수 대조가 중심이 됐다. 결과 설명은 기존 EMR에서 관리하므로 Nexus의 업무 범위에서 분리했다. 다음 재검 날짜는 원장이 결정한 값을 사람이 입력하도록 했다. 요구사항이 구체화될 때 기존 설계를 고친 이력이 남아 있다는 점이 좋다. [업무 결정 기록](https://github.com/corcoidum/coriops-nexus/blob/f59793d1ec5090b88f74397d538885b645e2437f/docs/open-questions.md)

## 2. 짧은 기간에 개발의 형태가 달라졌다

공개 커밋 이력에서 보이는 흐름은 다음과 같다.

- Phase 0 설계와 검토 문서를 먼저 남겼다.
- 합성 자료를 쓰는 수동 대시보드로 업무 흐름을 확인했다.
- 실제 인계 절차에 맞춰 화면과 결과 저장 방식을 바꿨다.
- PostgreSQL 저장, Excel 가져오기·대조·지정 폴더 출력, 개인 로그인·권한·접속기록, 재검 목록을 붙였다.
- Stage 0에서 작업 규칙과 CI를 정리했다.
- Stage A-1에서 정식 모델 v0.2와 문서 생성기, 모델·코드·문서 일치 검사를 병합했다.

기능이 빠르게 늘어난 만큼 변경 단위도 중요해졌다. DB 장부·인증·재검 기능을 묶은 PR #2는 검토 범위가 넓다. 이후 Stage 0과 A-1을 별도 PR로 나눈 흐름이 더 유지하기 좋다. 앞으로 데이터 이전과 Rule/Task 구현도 각각 독립적으로 검토하고 되돌릴 수 있는 단위로 이어갈 필요가 있다. [PR #2](https://github.com/corcoidum/coriops-nexus/pull/2), [PR #4](https://github.com/corcoidum/coriops-nexus/pull/4), [PR #5](https://github.com/corcoidum/coriops-nexus/pull/5)

## 3. 가장 좋은 변화는 모델을 시험 대상으로 만든 것이다

Stage A-1의 성과는 온톨로지 그림을 추가한 데 그치지 않는다. `ontology/coriops.yaml`을 원천으로 문서를 생성하고, 구현된 클래스의 열·타입·NULL 허용·외래키·고유 제약을 코드 테이블과 비교한다. enum, 화면 단계, 권한표의 연결도 검사한다. 새 테이블이 생겼는데 모델 설명이 빠지는 경우도 잡는다.

이는 문서가 구현과 따로 낡아가는 문제를 줄이는 장치다. 구현 12개·예정 9개 클래스를 구분한 것도 현재 상태를 이해하는 데 도움이 된다. 다만 구현 12개가 모두 독립 DB 테이블이라는 뜻은 아니다. 코드 목록이나 내장 구조도 포함된다. [모델 일치 시험](https://github.com/corcoidum/coriops-nexus/blob/f59793d1ec5090b88f74397d538885b645e2437f/tests/prototype/test_ontology.py), [문서 생성기](https://github.com/corcoidum/coriops-nexus/blob/f59793d1ec5090b88f74397d538885b645e2437f/scripts/gen_docs.py)

현재 업무 데이터는 여전히 `ledger_entries`에 여러 개념을 함께 담고 있다. 환자·검사·검체·결과·원장 지시·재검을 분리하고 기존 자료를 이전하는 A-2가 남았다. 따라서 A-1 완료를 공통 모델의 DB 적용 완료로 읽으면 안 된다. 다음 검증은 이전 전후의 건수, 결과, 재검 일정이 같고 `upgrade → downgrade → upgrade`가 가능한지 확인하는 일이다. [Stage A 계획](https://github.com/corcoidum/coriops-nexus/blob/f59793d1ec5090b88f74397d538885b645e2437f/ROADMAP.md)

## 4. 운영 지원과 의료 판단의 경계가 분명하다

등록된 결과 코드와 구조화된 값을 저장하고, 코드의 임상 의미나 재검 주기를 시스템이 임의로 정하지 않는 방향이 일관된다. 코드 의미를 확인할 약어 사전이 미정인 부분도 결정 대기 항목으로 남겨 두었다. 시스템은 기한·누락·진행 상태를 계산하고, 의료 판단은 사람이 담당한다.

개인 계정, 역할별 권한, CSRF 검사, 접속기록의 추가 전용 제약, 해시 체인 검증까지 구현한 점도 의미가 있다. 특히 접속기록 변경·삭제를 애플리케이션 관례에만 맡기지 않고 DB 트리거로 거부하는 시험이 있다. 다만 해시 체인과 DB 트리거만으로 모든 관리자 수준의 변경을 막는다고 평가할 수는 없다. DB 계정 분리와 외부 체크포인트는 남은 운영 통제다. [보안·접속기록 시험](https://github.com/corcoidum/coriops-nexus/blob/f59793d1ec5090b88f74397d538885b645e2437f/tests/prototype/test_auth_access_log.py)

## 5. 실패를 주입하자 보인 개선점

이번 리뷰에서 우선순위를 높게 본 부분은 **업무 변경과 접속기록 저장의 원자성**이다. 업무 저장이 끝난 뒤 별도 transaction으로 접속기록을 저장한다. 합성 자료 시험에서 접수 직후 로그 저장만 실패시키면 요청은 예외로 끝나지만, 새 장부 행은 DB에 남고 해당 CREATE 접속기록은 남지 않았다.

이 경우 화면에서 실패를 본 사용자가 같은 일을 다시 입력할 수 있고, 업무 데이터와 감사 기록의 대응도 어긋난다. 로그 실패 시 응답을 막는 것과 업무 변경까지 되돌리는 것은 서로 다른 보장이다. 실데이터 운영 전에는 같은 transaction에서 업무 변경과 필수 감사 이벤트를 함께 저장하거나, 내구성 있는 이벤트 저장과 재처리 절차를 마련해야 한다. 파일 출력은 DB transaction만으로 되돌릴 수 없으므로 별도 복구 절차도 필요하다. [업무 요청 처리](https://github.com/corcoidum/coriops-nexus/blob/f59793d1ec5090b88f74397d538885b645e2437f/app/modules/endoscopy_pathology/routes_manual_dashboard.py), [업무 저장](https://github.com/corcoidum/coriops-nexus/blob/f59793d1ec5090b88f74397d538885b645e2437f/app/modules/endoscopy_pathology/ledger_db.py), [접속기록 저장](https://github.com/corcoidum/coriops-nexus/blob/f59793d1ec5090b88f74397d538885b645e2437f/app/kernel/access_log.py)

이것은 이번 검토에서 재현한 항목이며 원본 저장소에는 수정하지 않았다. 기존 테스트 통과가 보장하는 범위를, 실패 상황까지 넓혀야 할 이유다.

## 6. 현재 상태를 설명하는 문서도 정리해야 한다

README에는 DB 장부·로그인이 구현됐다는 설명과, 영구 DB·인증·마이그레이션이 후속 범위라는 예전 설명이 함께 남아 있다. ROADMAP의 테스트 수 267개도 검토 커밋의 실제 결과 283개보다 오래됐다.

첫 화면에서 메모리 시연, DB 장부, 정식 운영 준비를 구분하고, 실행 방법과 완료·미완료 범위를 각각 연결하면 새 기여자와 미래의 작성자 모두 덜 헷갈린다. 생성 문서 검사는 유용하지만 README 같은 수동 문서의 정확성까지 보장하지는 않는다. [검토 당시 README](https://github.com/corcoidum/coriops-nexus/blob/f59793d1ec5090b88f74397d538885b645e2437f/README.md)

## 7. 확인한 것과 아직 확인하지 않은 것

- 해당 커밋의 GitHub Actions CI 성공과 로그의 `283 passed`를 확인했다.
- 별도 Docker 환경의 Python 3.12·PostgreSQL 16에서 기존 테스트 283개가 모두 통과했다.
- `pyflakes` 정적 검사와 생성 문서 `--check`가 통과했다.
- 별도 합성 실패 주입 시험으로 로그 저장 실패 뒤 업무 행이 남는 상황을 확인했다. 이 시험은 현재 동작을 확인하는 리뷰용 시험이며 수정 완료를 뜻하지 않는다.
- 테스트에는 TestClient 관련 deprecation warning 1건이 있었다.
- 이번 리뷰에서 실제 브라우저 조작, 원내 LAN 설치, 실제 Excel 대조, 백업 복원은 수행하지 않았다. 업무시간 절감이나 누락 감소도 실측하지 않았다.

CI와 로컬 재검증은 구현의 재현성을 뒷받침한다. 실제 운영 성과를 입증하는 자료는 별도로 필요하다. [검토 커밋의 CI 실행](https://github.com/corcoidum/coriops-nexus/actions/runs/40190435434)

## 8. 다음 개발의 우선순위

첫째, 업무 변경과 필수 감사 이벤트의 저장·복구 경계를 맞추고 로그 실패·재시도 시험을 추가한다. README의 현재 상태 설명도 함께 정리한다.

둘째, A-2에서 공통 모델로 자료를 이전하되 기존 화면과 결과를 보존한다. 이어 Stage B에서 Rule 실행 이력과 Task를 영구 저장하고, 반복 실행해도 같은 업무가 중복 생성되지 않는지 확인한다. 현재 지연·도래 표시는 화면 계산이며, 영구 Rule/Task Engine은 아직 구현되지 않았다.

셋째, 실데이터 투입 전 HTTPS, 접속 대역 제한, DB 계정 분리, 암호화 백업·복원 리허설, 역할·보관기간·출력 정책 승인을 운영 관문으로 확인한다. 이는 ROADMAP에도 남은 일로 적혀 있다.

그 뒤에야 기존 장부와 DB 차이, 미완료 재검 건수, 확인 소요 시간 같은 지표를 병행 기간에 측정할 수 있다. 지금 단계의 성과는 업무 효과가 입증됐다는 데 있지 않다. **현장에서 확인한 규칙을 코드·데이터 모델·테스트로 함께 남기고, 아직 결정하지 않은 것을 구현 완료와 구분하기 시작했다는 데 있다.** AI 도구 계층은 이 기반 위에서 읽기 전용 조회부터 붙이는 순서가 적절하다.
