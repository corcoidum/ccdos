# CORCOIDUM OS

> Where hearts and codes coexist, the future of technology is human.

CORCOIDUM OS는 의료 현장에서 얻은 **비식별 운영 인사이트**와 개인의 학습·개발 경험을 안전한 지식, 재사용 가능한 소프트웨어, 공개 사례 연구로 연결하는 1인용 운영체제입니다.

현재 저장소는 **Phase 7 — Public Wiki / RAG MVP**까지 구현한 초기 상태입니다. Vault 예시와 검증기를 기반으로 다음 자동화를 단계별로 추가합니다.

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
site/                 openkiki.org 정적 웹 애플리케이션
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

## 다음 단계

Phase 6은 배포 상태·오류·주간 리뷰를 비식별 요약으로 생성합니다. Discord 전송은 `DISCORD_WEBHOOK_URL` Secret 또는 로컬 환경 변수가 있고 명시적으로 요청될 때만 수행합니다. 자세한 절차는 [Automation MVP Runbook](docs/runbooks/automation-mvp.md)을 따릅니다.

## Phase 7 Public Wiki 검색

```powershell
python rag/search_public_wiki.py "automation"
```

이 검색은 승인된 Public index만 대상으로 하며, 현재 단계에서는 외부 LLM을 호출하지 않습니다. 자세한 경계와 사용 방법은 [RAG README](rag/README.md)를 참조하세요.

Cloudflare Workers Static Assets 배포 절차는 [Cloudflare Worker 배포 Runbook](docs/runbooks/cloudflare-worker-deploy.md)을 따릅니다. Worker 이름은 `ccdos`이며, 계정 서브도메인 기준 공개 주소는 `https://ccdos.corcoidum.workers.dev`입니다.
