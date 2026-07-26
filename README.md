# CORCOIDUM OS

> Where hearts and codes coexist, the future of technology is human.

**민감한 현장 기록에서 공개해도 되는 것만, 사람의 승인을 거쳐 내보내는 발행 하네스(human-in-the-loop publishing harness).**

의료기관 원무 행정 실무자가 만들었습니다. 다루는 기록의 대부분은 공개할 수 없고, 공개 가능한 인사이트는 그 안에 섞여 있습니다. 이 저장소는 그 경계를 사람의 조심성이 아니라 **기계가 강제하는 파이프라인**으로 구현한 것이며, 그 결과물로 공개 지식 정원과 사례 연구 사이트가 나옵니다.

공개 사이트: <https://ccdos.corcoidum.workers.dev>

---

## 왜 이렇게 만들었나

현장 기록은 그대로 두면 사장되고, 그대로 내보내면 사고가 됩니다. "조심해서 쓰기"는 정책이 아니라 희망입니다. 그래서 다음 세 가지를 시스템의 전제로 삼았습니다.

- **사람의 승인 없이는 아무것도 밖으로 나가지 않는다.** 자동 발행은 없습니다.
- **기계는 명백한 위반만 잡고, 판단은 사람이 한다.** 검증기는 안전을 보장하지 않으며, 사람 검토를 대체하지 않습니다.
- **발행된 모든 것은 사후에 감사할 수 있어야 한다.** 승인 증적과 결정론적 산출물이 git 히스토리에 남습니다.

## 하네스 구조

```text
  기록 작성            기계 검증           사람 검토·승인          결정론적 빌드          자동 집행
 ┌──────────┐      ┌───────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────┐
 │ Obsidian │─────▶│ validate_ │─────▶│ publish_state│─────▶│ build_public │─────▶│ CI gate  │
 │  Vault   │      │ notes.py  │      │  + 검토 증적  │      │ content/graph│      │ + 배포   │
 └──────────┘      └───────────┘      └──────────────┘      └──────────────┘      └──────────┘
   draft            필수 필드         checklist 완료         approved만 수집        --check 회귀
                    민감 패턴 차단     증적 frontmatter 기록   index/graph.json      통과해야 배포
```

| 단계 | 구현 | 하는 일 | 하지 않는 일 |
| --- | --- | --- | --- |
| 기계 검증 | `automation/validate_notes.py` | 필수 frontmatter, Vault별 보안 분류, 주민등록번호·전화·이메일·비밀값 등 고신뢰 민감 패턴 차단 | 완전한 비식별 보장 |
| 사람 승인 | `docs/governance/public-content-review.md` | 재식별 가능성·맥락 판단, checklist 완료 후 증적 기록 | 자동화 |
| 증적 무효화 | 검증기 규칙 | 승인 후 수정된 노트의 이전 검토 증적 재사용 차단 | — |
| 결정론적 빌드 | `automation/build_public_content.py`, `automation/build_public_graph.py` | `approved`·`published`만 `content/public/index.json`·`content/public/graph.json`으로 수집, `--check`로 재현성 검증 | 추론·자동 관계 생성 |
| 자동 집행 | GitHub Actions | 위 규칙을 통과하지 못하면 배포 차단 | — |

같은 원칙이 답변 계층에도 적용됩니다. `/api/answer`는 승인된 공개 출처만 근거로 전달하고, 비밀값 부재·근거 부재·rate limit·일일 예산 초과·provider 오류·잘못된 인용 중 어느 하나라도 발생하면 **생성 없이 retrieval-only로 폴백**합니다. 지식 그래프도 사람이 frontmatter에 직접 선언한 관계만 edge가 되며, 자동 관계 추론은 하지 않습니다.

## 안전 경계

- `ClinicOps-Local`은 로컬 전용이며 GitHub·Discord·클라우드 동기화·LLM으로 절대 전송하지 않습니다. 이 저장소에는 존재하지 않고, 구조 예시인 `ClinicOps-Local.example`만 둡니다.
- 공개물은 `CORCOIDUM-Public`의 `approved` 이상 콘텐츠만 사용합니다. 이 Vault에는 사람이 검토·승인한 발행 기록만 들어갑니다.
- 실제 환자·직원 식별 정보와 비밀값은 저장소에 넣지 않습니다.
- 정보 유형별 단일 권위 원천: 지식은 Obsidian, 코드·변경 이력은 GitHub, 상태·승인 제어는 Discord.

## 이 패턴이 향하는 곳

발행 하네스의 구조 — **자동 검증 → 사람 승인 → 감사 증적 → 재현 검증 → 자동 집행** — 는 공개 노트가 아닌 대상에도 그대로 적용됩니다. 의료기관 행정 워크플로에서 자동화가 어려운 이유는 기술이 아니라 책임 소재이며, 사람의 승인 지점과 감사 기록을 구조에 내장하면 그 장벽이 낮아집니다. 이 저장소는 그 패턴을 가장 안전한 대상(공개해도 되는 자신의 기록)으로 먼저 구현한 것입니다.

## 현재 상태

| 항목 | 수 |
| --- | --- |
| 발행된 공개 기록 | 16 |
| 아키텍처 결정 기록(ADR) | 7 |
| 거버넌스 정책 문서 | 7 |
| 자동화 스크립트 | 10 |
| 테스트 | 8개 모듈 · 68개 |

`Phase 9 — Living Values`까지 완료했습니다. 네 가지 약속(H.OPE · T.RUST · M.ERCY · L.OVE) 각각에 승인·발행 증적이 있는 공개 기록이 3편 이상 쌓인 것을 2026-07-24에 확인했습니다. 판정 근거는 [Phase 9 완료 보고서](docs/architecture/phase-9-completion-report.md)에, 완료 기준은 [Phase 9 계획](docs/architecture/phase-9-plan.md)에 있습니다.

## 검증하기

Python 3.12 이상, Node.js가 필요합니다.

```powershell
# 아키텍처 불변식 — 컴포넌트 소유자 존재, S3_RESTRICTED 외부 유출 경로 부재
python scripts/verify_phase0.py

# 노트 검증 — frontmatter, 보안 분류, 승인 메타데이터, 민감 패턴
python automation/validate_notes.py

# 결정론적 산출물 — 재생성 결과가 커밋본과 다르면 실패
python automation/build_public_content.py --check
python automation/build_public_graph.py --check
python automation/build_public_glossary.py --check

# 전체 테스트와 lint
python -m unittest discover -s tests -v
ruff check

# 승인된 공개 index만 대상으로 하는 검색 (외부 LLM 호출 없음)
python rag/search_public_wiki.py "automation"

# 사이트
cd site && npm ci && npm run typecheck && npm test && npm run build
npm exec wrangler -- deploy --dry-run
```

## 저장소 구조

```text
docs/                 아키텍처, 거버넌스, ADR, 런북
vaults/               Vault 구조 — 승인된 공개 기록과 로컬 Vault 구조 예시
schemas/              공통 메타데이터 스키마
templates/            Obsidian 노트 템플릿
content/              승인된 공개 콘텐츠 산출물 (index.json, graph.json)
site/                 Cloudflare Worker API + 정적 웹 애플리케이션
automation/           검증·발행·그래프·Discord·주간 검토 자동화
rag/                  승인된 문서만 검색하는 RAG
tests/ fixtures/      합성 테스트 데이터와 검증
scripts/              저장소 수준 검증 도구
```

주요 화면: `/garden`(공개 기록), `/graph`(사람이 선언한 관계만 표시하는 읽기 전용 지식 지도), `/lab`(승인된 index만 검색하는 공개 위키 검색), `/projects`(Phase별 목적·구현·안전 경계·검증 증거). 네 가치 공간 `/hope` · `/trust` · `/mercy` · `/love`는 각 약속에 속한 기록을 모아 보여 줍니다.

## 설계 결정

| ADR | 결정 |
| --- | --- |
| [0001](docs/adr/0001-small-maintainable-stack.md) | 작은 교체 가능한 스택 — 유지보수·보안 검토 범위 최소화 |
| [0002](docs/adr/0002-grounded-answer-layer.md) | 근거 없으면 답하지 않는 답변 계층 |
| [0003](docs/adr/0003-openai-provider-migration.md) | 생성 provider 이관 |
| [0004](docs/adr/0004-public-knowledge-graph-foundation.md) | 사람이 선언한 관계만 그래프가 된다 |
| [0005](docs/adr/0005-derived-note-navigation.md) | 파생 노트 내비게이션 |
| [0006](docs/adr/0006-content-scaling-ladder.md) | git이 DB다 — 실측 트리거 전까지 DB 도입 금지 |
| [0007](docs/adr/0007-read-only-knowledge-map.md) | 읽기 전용 지식 지도 |

거버넌스 정책은 [`docs/governance/`](docs/governance/)에, 배포 절차는 [Cloudflare Worker 배포 Runbook](docs/runbooks/cloudflare-worker-deploy.md)에 있습니다. Worker 이름은 `ccdos`입니다.
