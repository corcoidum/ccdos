# ADR-0007: 승인 공개 관계의 Read-only Knowledge Map

**상태:** 승인됨

**날짜:** 2026-07-22

## 맥락

Knowledge Graph Foundation과 ADR-0005는 사람이 선언한 공개 edge, backlinks, Related Notes를 결정론적 `graph.json` version 2로 제공한다. 현재 공개 graph에는 화면의 의미와 접근성을 실제 데이터로 검증할 수 있는 node와 edge가 쌓였지만, 관계 방향을 잃지 않고 전체 연결을 살펴볼 route는 없었다.

## 결정

- `/graph`는 `content/public/index.json`과 `content/public/graph.json`만 소비하는 read-only SPA route로 만든다.
- UI는 관계를 생성·수정·저장하지 않으며 Markdown frontmatter만 계속 권위 원천으로 둔다.
- `related_to`만 undirected로 표시하고 나머지 relation은 선언된 `source → target` 방향을 화살표로 보존한다.
- note별 연결 projection은 incoming, outgoing, undirected 방향과 복수 relation type을 잃지 않는 공통 model에서 계산한다. Note modal과 Knowledge Map이 같은 model을 사용한다.
- node 위치는 ID 정렬에 따른 deterministic radial layout으로 계산한다. force-directed layout, Canvas, WebGL, 외부 graph library는 도입하지 않는다.
- Desktop SVG는 보조 시각화이며 전체 제목을 제공하는 HTML 기록 목록과 상세 panel을 접근 가능한 canonical UI로 둔다. 작은 화면에서는 축소 SVG를 숨기고 목록을 우선한다.
- node의 전문 읽기는 기존 note modal과 `?note=<id>` deep link를 재사용한다.
- Living Value와 relation type 필터는 화면 표시만 바꾸며 graph artifact를 변경하지 않는다.

## 경계

- 승인·발행된 `CORCOIDUM-Public` note만 표시한다.
- `ClinicOps-Local`, `CORCOIDUM-Core`, draft/review 콘텐츠, 환자·직원·기관 식별 정보는 소비하지 않는다.
- LLM, embedding, 자동 관계 추론, 외부 API, database, analytics를 사용하지 않는다.
- 고립된 공개 node도 숨기지 않는다.
- Graph route는 Phase 9의 Living Values 콘텐츠 완료 조건을 변경하지 않는다.

## 결과

방문자는 공개 기록의 전체 연결을 방향과 출처를 유지한 채 탐색하고 기존 전문 modal로 이동할 수 있다. 정적 artifact와 deterministic layout만 사용하므로 입력이 같으면 표시 순서와 위치가 같고, 생성 계층이나 외부 서비스 장애와 독립적으로 동작한다.
