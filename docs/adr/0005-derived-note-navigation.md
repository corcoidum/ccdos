# ADR-0005: Graph edge에서 Backlinks와 Related Notes를 파생

**상태:** 승인됨

**날짜:** 2026-07-20

**부분 대체:** ADR-0004의 자동 backlinks 보류 결정

## 맥락

ADR-0004는 사람이 선언한 note-to-note edge를 먼저 안전하게 구축하고 backlinks는 후속 단계로 미뤘다. note 상세 화면이나 검색 결과가 관계를 효율적으로 소비하려면 매번 전체 edge 배열을 탐색하지 않고 note별 역방향·연관 목록을 조회할 수 있어야 한다.

## 결정

- 별도 권위 원천이나 manifest를 만들지 않고 `graph.json` node에 `backlinks`와 `related_notes`를 추가한다.
- `backlinks`는 현재 node를 target으로 가진 모든 edge의 `source`와 `type`을 보존한다.
- `related_notes`는 의미상 대칭인 `related_to` edge에서만 양방향으로 계산한다.
- 원본 `edges`에는 reverse edge를 생성하지 않는다.
- 두 목록은 사람이 작성하지 않으며 build 시 검증된 edge에서만 계산한다.
- validator는 두 projection이 edge와 정확히 일치하고, 중복 없이 정렬되며, 승인 graph node만 참조하는지 검사한다.
- node 계약이 바뀌므로 graph artifact version을 2로 올린다.

## 결과

향후 Related Notes UI와 backlink 표시가 단순해지지만 공개 의미의 권위는 계속 frontmatter `relations`에만 있다. projection을 수동 수정하거나 LLM·tag 유사도로 보강하는 것은 허용하지 않는다. 실제 승인 노트에 관계가 없는 현재 상태에서는 두 목록이 빈 배열이어도 정상이다.
