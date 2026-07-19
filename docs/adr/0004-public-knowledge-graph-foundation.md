# ADR-0004: 승인된 Public note-to-note graph부터 시작

**상태:** 승인됨

**날짜:** 2026-07-20

## 맥락

공개 Second Brain과 Knowledge Graph UI로 확장하려면 먼저 관계의 권위 원천, 공개 범위, target 검증과 재현 가능한 artifact 계약이 필요하다. 초기부터 non-note registry나 자동 추론을 도입하면 Markdown 중심 거버넌스와 검토 범위가 불필요하게 커진다.

## 검토한 선택지

1. 승인된 Public note 간 관계만 frontmatter에 선언한다.
2. `concept`, `project`, `principle`, `tool`, `value`, `phase`를 별도 registry에 선언한다.

선택지 1은 Obsidian Markdown을 단일 권위 원천으로 유지하고 target을 Public note ID 집합으로 즉시 검증할 수 있다. 선택지 2는 확장성은 높지만 새로운 권위 원천, node별 검토 수명주기와 잘못된 registry 참조 정책이 먼저 필요하다.

## 결정

- 첫 구현은 선택지 1인 note-to-note only로 제한한다.
- `relations`는 Public Markdown frontmatter에서 사람이 선언한다.
- 공개 node 집합은 기존 index와 같은 `approved`/`published` 집합으로 고정하고 graph는 더 적은 metadata만 노출한다.
- `related_to`는 의미상 대칭이지만 reverse edge를 생성하거나 반대 선언을 강제하지 않는다.
- `generated_at`은 제외하고 모든 배열을 명시적으로 정렬한다.
- non-note registry, 자동 backlinks, graph UI와 자동 관계 추론은 도입하지 않는다.

## 결과

관계가 0개여도 승인된 공개 node 집합과 검증 파이프라인부터 안전하게 배포할 수 있다. 실제 승인 노트를 수정하지 않고 합성 fixture로 edge 동작을 검증하므로 기존 approval evidence를 건드리지 않는다. non-note node가 실제 탐색 요구가 되었을 때 별도 ADR로 registry의 권위 원천과 review lifecycle을 결정한다.
