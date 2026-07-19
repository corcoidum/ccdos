# 공통 노트 메타데이터

모든 추적 대상 Markdown 노트는 YAML frontmatter에 아래 필드를 명시한다. 자동화는 내용을 추론하지 않고 이 메타데이터와 파일 위치만 신뢰한다.

| 필드 | 설명 |
| --- | --- |
| `id` | 소문자 kebab-case의 안정적인 식별자 |
| `title` | 사람이 읽는 제목 |
| `created`, `updated` | UTC ISO 8601 시각 (`Z`) |
| `classification` | `S0_PUBLIC`, `S1_PRIVATE`, `S2_INTERNAL_DEIDENTIFIED` 중 하나 |
| `visibility` | `local`, `private`, `public` 중 하나 |
| `publish_state` | `draft`, `review`, `approved`, `published`, `archived` 중 하나 |
| `tags` | YAML 목록의 간단한 태그 |
| `relations` | 선택 사항. 승인된 Public 노트 ID와 허용 relation type을 가진 object 목록 |

`approved`와 `published`는 `approved_by`, `approved_at`을 필수로 한다. `published`는 추가로 `published_at`을 요구한다. 실제 개인·환자·직원 정보 및 `S3_RESTRICTED` 분류 노트는 이 저장소의 어떤 경로에도 저장하지 않는다.

`CORCOIDUM-Public`에서 `review` 이상 상태를 사용하면 Phase 2 검토 증적도 필수다. `review_requested_at`, `privacy_reviewed_by`, `privacy_reviewed_at`, `privacy_review_result: passed`, `reviewed_revision`을 기록하고, `reviewed_revision`은 현재 `updated`와 같아야 한다. 내용을 수정하면 `publish_state: draft`로 되돌린 뒤 새 검토를 요청한다.

JSON Schema는 도구 호환성과 문서화를 위한 기준이며, 표준 라이브러리만 사용하는 실제 검사는 `automation/validate_notes.py`가 수행한다.

`relations`는 `CORCOIDUM-Public`에서만 공개 graph 입력으로 사용한다. 현재 허용 type과 방향은 [Public Knowledge Graph 정책](../docs/governance/public-knowledge-graph.md)에 정의되어 있다. `content/public/graph.json` version 2 계약은 `knowledge-graph.schema.json`에 문서화하며, backlinks와 Related Notes도 선언 edge에서만 계산한다. 실제 build 검증은 Python 표준 라이브러리만 사용한다.
