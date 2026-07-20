# Public Knowledge Graph 정책

## 목적과 경계

Knowledge Graph Foundation은 승인된 공개 기록 사이에서 사람이 검토한 연결을 정적 데이터로 표현한다. 이번 단계의 목적은 graph UI나 자동 추천이 아니라, 향후 Second Brain 탐색 기능이 신뢰할 수 있는 작고 재현 가능한 계약을 만드는 것이다.

포함되는 데이터는 `vaults/CORCOIDUM-Public/`의 `approved` 또는 `published` 노트에서 이미 공개 승인을 받은 ID, 제목, tag, 상태, 시각과 명시적 `relations`뿐이다. 본문은 기존 `index.json`에만 있고 graph에는 복제하지 않는다.

다음 데이터는 포함하지 않는다.

- `draft`, `review`, `archived` 노트
- `CORCOIDUM-Core`, `ClinicOps-Local` 및 private/local identifier
- 실제 환자·보호자·직원·기관 운영 식별 정보
- LLM, embedding, tag 유사도 또는 자동 의미 추론으로 만든 관계
- 외부 API, vector DB, graph DB에서 가져온 데이터

Obsidian Markdown이 단일 권위 원천이며 `content/public/graph.json`은 언제든 다시 만들 수 있는 파생 artifact다. 기존 Privacy Review, approval evidence, `reviewed_revision` 규칙을 먼저 통과해야 한다.

## Frontmatter 계약

관계는 Public 노트에서 다음 block-list object 형식으로만 선언한다.

```yaml
relations:
  - target: safe-automation-case-study
    type: related_to
  - target: search-that-does-not-guess
    type: builds_on
```

`target`은 같은 Public Vault에 존재하는 `approved` 또는 `published` 노트 ID여야 한다. 현재 Phase에서는 note-to-note 관계만 허용한다.

| type | 방향과 의미 |
| --- | --- |
| `related_to` | 일반적인 의미 관계. 의미상 양방향이지만 artifact에는 사람이 선언한 현재 → 대상 edge 하나만 저장한다. |
| `builds_on` | 현재 노트가 대상 노트의 생각이나 작업을 발전시킨다. |
| `supports` | 현재 노트가 대상 노트에 기록된 원칙·개념·주장을 뒷받침한다. |
| `demonstrates` | 현재 노트가 대상 노트에 기록된 가치나 운영 원칙을 실제 사례로 보여 준다. |
| `implemented_by` | 현재 노트의 개념이나 기록이 대상 프로젝트 노트로 구현된다. |
| `uses` | 현재 실험·프로젝트 노트가 대상 노트에 기록된 기술 또는 도구를 사용한다. |

`related_to`의 역방향 edge를 build가 자동 생성하지 않으며, 반대 선언도 요구하지 않는다. 미래 UI는 이 type을 표시할 때만 undirected 관계로 해석할 수 있지만 원본 edge 자체를 변경해서는 안 된다.

## Backlinks와 Related Notes

두 탐색 목록은 새 지식이나 새 edge가 아니라, 이미 검증된 선언 edge를 note별로 조회하기 위한 결정론적 projection이다.

- `backlinks`: 현재 note를 `target`으로 가리키는 모든 edge를 `{source, type}`으로 보존한다. 방향과 relation type을 잃지 않는다.
- `related_notes`: `related_to` edge만 양 끝 note에 서로의 ID를 추가한다. `builds_on`, `supports`, `demonstrates`, `implemented_by`, `uses`는 방향 의미가 있으므로 Related Notes로 자동 승격하지 않는다.

역 edge는 여전히 `edges`에 생성하지 않는다. builder는 node의 두 목록을 ID와 type으로 정렬하며, validator는 목록이 edge에서 계산한 값과 정확히 같은지 확인한다. 사람이 `backlinks`나 `related_notes`를 frontmatter에 직접 작성하지 않는다.

## Blocking error와 warning

다음은 build를 차단한다.

- relation object의 `target` 또는 `type` 누락, 빈 target, 예상 밖 필드
- 허용되지 않은 relation type
- 존재하지 않는 target 또는 private/local identifier 시도
- `draft` 또는 `review` target
- 자기 참조 또는 동일 source-target-type 중복
- duplicate note/graph node ID
- graph edge가 공개 node 집합 밖을 참조함
- graph schema 위반 또는 source와 다른 stale artifact
- 기존 `content/public/index.json` gate 실패

오류는 본문을 출력하지 않고 note ID, relation index/target, 실패 rule만 보고한다. 일반 note metadata 오류는 기존 validator의 안전한 파일 경로와 rule 형식을 유지한다.

다음 graph 품질 신호는 `WARN`이며 CI를 실패시키지 않는다.

- 관계가 없는 공개 노트
- 한 노트의 관계가 12개를 초과함
- 같은 source-target에 여러 relation type이 선언되어 사람의 의미 검토가 필요함

`related_to` 역방향 불일치는 오류나 warning이 아니다. 단일 선언을 허용한다는 정책 결정으로 중복 authoring을 피한다.

## Graph JSON 계약과 재현성

`schemas/knowledge-graph.schema.json`의 version 2 계약은 다음과 같다.

```json
{
  "version": 2,
  "nodes": [
    {
      "id": "search-that-does-not-guess",
      "type": "note",
      "label": "추측하지 않는 검색",
      "url": "/garden?note=search-that-does-not-guess",
      "tags": ["automation", "retrieval"],
      "state": "published",
      "updated": "2026-07-13T08:54:00Z",
      "published_at": "2026-07-13T08:59:28Z",
      "backlinks": [
        {
          "source": "value-of-invisible-work",
          "type": "related_to"
        }
      ],
      "related_notes": ["value-of-invisible-work"]
    },
    {
      "id": "value-of-invisible-work",
      "type": "note",
      "label": "화면에 보이지 않는 작업의 가치",
      "url": "/garden?note=value-of-invisible-work",
      "tags": ["case-study", "ci"],
      "state": "published",
      "updated": "2026-07-13T08:54:00Z",
      "published_at": "2026-07-13T08:59:28Z",
      "backlinks": [],
      "related_notes": ["search-that-does-not-guess"]
    }
  ],
  "edges": [
    {
      "source": "value-of-invisible-work",
      "target": "search-that-does-not-guess",
      "type": "related_to"
    }
  ]
}
```

node URL은 `/garden?note=<note-id>` 형식의 read-only deep link이며, query의 note ID는 해당 node ID와 정확히 일치해야 한다. node는 ID, tag와 Related Notes는 문자열, backlinks는 `source → type`, edge는 `source → target → type` 순으로 정렬한다. JSON key 삽입 순서도 builder에서 고정한다. 실행 시각은 source 사실이 아니고 매 실행 diff를 만들기 때문에 `generated_at`을 두지 않는다.

## 검증과 build

```powershell
python automation/validate_notes.py vaults/CORCOIDUM-Public
python automation/build_public_content.py --check
python automation/build_public_graph.py
python automation/build_public_graph.py --check
python -m unittest discover -s tests -v
```

graph build는 current public index를 선행 조건으로 확인한다. 같은 입력은 byte 단위로 같은 JSON을 생성하며, `--check`는 기존 artifact의 JSON 계약과 source 일치를 모두 확인한다.

## 변경과 사람 승인

`relations`는 공개 의미를 추가하는 frontmatter 콘텐츠다. 승인 또는 발행된 노트에서 관계를 추가·수정·삭제하면 `updated`를 바꾸고 `publish_state: draft`로 되돌린 뒤 Privacy Review와 approval evidence를 새로 기록해야 한다. builder는 증적을 만들거나 갱신하지 않는다.

자동 관계 추론은 그럴듯하지만 검토되지 않은 주장, 비공개 맥락의 간접 노출, 재현하기 어려운 모델 변경을 만들 수 있어 현재 허용하지 않는다. 관계의 의미와 공개 적합성에 책임질 사람만 이를 선언하고 diff에서 검토해야 한다.

## 향후 확장

작은 후속 단계로 생성된 backlinks와 Related Notes를 소비하는 read-only UI를 만들 수 있다. 그 다음에만 local graph, `/graph` route, `concept`, `project`, `principle`, `tool`, `value`, `phase` registry, knowledge path, graph-assisted retrieval을 검토한다. registry가 도입되더라도 Public 승인 경계와 Markdown 권위 원천을 우회할 수 없다.

이 Foundation은 Living Values 콘텐츠를 축적하는 Phase 9의 완료 조건을 변경하지 않는다. Phase 9 기록을 연결하고 탐색하기 위한 횡단 기반 기능이며, 콘텐츠 축적과 사람 검토를 대신하지 않는다.
