# CORCOIDUM OS

> Where hearts and codes coexist, the future of technology is human.

CORCOIDUM OS는 의료 현장에서 얻은 **비식별 운영 인사이트**와 개인의 학습·개발 경험을 안전한 지식, 재사용 가능한 소프트웨어, 공개 사례 연구로 연결하는 1인용 운영체제입니다.

현재 저장소는 **Phase 8b — Grounded Answer Layer**까지 구현했습니다. 승인된 공개 기록만 검색·인용하고, 생성 계층이 사용할 수 없으면 retrieval-only로 안전하게 폴백합니다.

지금은 **Phase 9 — Living Values**를 진행 중입니다. 네 가지 약속(H.O.P.E · T.R.U.S.T · M.E.R.C.Y · L.O.V.E)에 맞춘 공개 기록을 쌓아 갑니다. 계획은 [phase-9-plan.md](docs/architecture/phase-9-plan.md)에 있습니다.

## 원칙

- `ClinicOps-Local`은 로컬 전용이며 GitHub, Discord, 클라우드 동기화·LLM으로 절대 전송하지 않습니다.
- 공개물은 `CORCOIDUM-Public`의 `approved` 콘텐츠만 사용합니다.
- Obsidian은 지식, GitHub는 코드·변경 이력, Discord는 상태·승인 제어의 단일 권위 원천입니다.
- 실제 환자·직원 식별 정보와 비밀값은 저장소에 넣지 않습니다.

## 현재 구조

```text
docs/                 아키텍처, 거버넌스, ADR, 운영 문서
vaults/               합성 예시만 포함한 안전한 Vault 구조
schemas/              공통 메타데이터 스키마
templates/            Obsidian 노트 템플릿
content/              승인된 공개 콘텐츠 원본
site/                 Cloudflare Worker API + 정적 웹 애플리케이션
automation/           검증·발행·Discord·주간 검토 자동화
rag/                  승인된 문서만 검색하는 RAG MVP
tests/ fixtures/      합성 테스트 데이터와 검증
scripts/              저장소 수준 검증 도구
```

## Phase 0 검증

Python 3.12 이상에서 다음 명령을 실행합니다.

```powershell
python scripts/verify_phase0.py
```

이 검증은 필수 아키텍처 컴포넌트의 소유자 존재와 `S3_RESTRICTED` 데이터의 외부 유출 경로 부재를 확인합니다. 이후 Phase에서 테스트와 CI로 확장합니다.

## Phase 1 검증

Python 3.12 이상에서 다음 명령을 실행합니다.

```powershell
python automation/validate_notes.py
python -m unittest discover -s tests -v
```

검증기는 `vaults/`의 예시 노트가 필수 frontmatter, Vault별 보안 분류, 승인 메타데이터 규칙을 지키는지 확인합니다. 또한 주민등록번호·휴대전화 번호·이메일·비밀값처럼 고신뢰 민감 패턴을 차단합니다. 완전한 비식별화를 보장하는 도구는 아니므로, 공개 전 사람의 검토가 항상 필요합니다.

## Phase 2 검증

`CORCOIDUM-Public`에서 `review` 이상 상태를 사용하려면 [공개 콘텐츠 검토 규칙](docs/governance/public-content-review.md)의 checklist를 완료하고 review 증적을 frontmatter에 기록합니다. 검증기는 승인 후 수정된 노트의 이전 review 증적 재사용을 차단합니다.

## Phase 3·4 검증

공개 콘텐츠 빌드는 `approved`·`published` 노트만 `content/public/index.json`으로 생성합니다. CI workflow도 같은 규칙을 검사합니다.

```powershell
python automation/build_public_content.py
python automation/build_public_content.py --check
```

## Phase 5 실행

```powershell
cd site
npm ci
npm run build
npm run dev
```

## Phase 7 Public Wiki 검색

```powershell
python rag/search_public_wiki.py "automation"
```

이 CLI와 기본 Browser 검색은 승인된 Public index만 대상으로 하며 외부 LLM을 호출하지 않습니다. 자세한 경계와 사용 방법은 [RAG README](rag/README.md)를 참조하세요.

## Phase 8 UI·Grounded Answer 검증

```powershell
cd site
npm ci
npm run typecheck
npm test
npm exec wrangler -- deploy --dry-run
```

- Garden은 처음 2개 기록과 접근 가능한 더보기·접기를 제공한다.
- 네 route는 touch와 trackpad 수평 gesture로 인접 페이지를 이동한다.
- `/api/answer`는 Worker가 선택한 승인 공개 출처만 OpenAI Responses API에 전달한다.
- Secret 부재, 근거 부재, rate limit, 일일 budget, provider 오류, 잘못된 인용은 retrieval-only로 폴백한다.

## 다음 단계

Production 생성은 Cloudflare Worker의 `OPENAI_API_KEY` Secret과 OpenAI project 사용량 한도를 함께 설정해 활성화합니다. 이후 실제 사용량, 429, provider fallback, 인용 실패율을 관찰해 경계를 조정합니다. 자세한 절차는 [Cloudflare Worker 배포 Runbook](docs/runbooks/cloudflare-worker-deploy.md)을 따릅니다.

Cloudflare Workers Static Assets 배포 절차는 [Cloudflare Worker 배포 Runbook](docs/runbooks/cloudflare-worker-deploy.md)을 따릅니다. Worker 이름은 `ccdos`이며, 계정 서브도메인 기준 공개 주소는 `https://ccdos.corcoidum.workers.dev`입니다.
