# CCDOS Cloudflare Workers 배포 Runbook

## 배포 방식

이 프로젝트는 Cloudflare **Workers Static Assets + Worker API**를 사용한다. Vite가 생성한 `site/dist/`와 `site/src/worker.ts`를 Worker 이름 `ccdos`에 함께 배포하며, 공개 주소는 `https://ccdos.corcoidum.workers.dev`다.

`wrangler.jsonc`은 SPA fallback, `/api/*` 우선 routing, rate limit, 일일 Durable Object budget과 observability를 설정한다. 비밀값·API key·환자 관련 데이터는 포함하지 않는다.

## 최초 로컬 배포

1. Cloudflare 대시보드에 로그인할 수 있는 계정으로, interactive terminal에서 아래 명령을 실행한다.

   ```powershell
   cd site
   npm run cf:whoami
   npx wrangler login
   npm run cf:whoami
   ```

2. 저장소 루트에서 승인 콘텐츠 index와 전체 검증을 확인한다.

   ```powershell
   python automation/build_public_content.py --check
   python -m unittest discover -s tests -v
   cd site
   npm ci
   npm run typecheck
   npm test
   ```

3. Secret 없이 먼저 배포하면 retrieval-only fallback 상태로 안전하게 동작한다.

   ```powershell
   cd site
   npm run deploy
   ```

## Grounded Answer 활성화

1. OpenAI Platform에서 project별 사용량 알림·상한과 API key rotation 정책을 먼저 설정한다.
2. 승인된 공개 질문만 사용하는지 로컬 `npm test`로 확인한다.
3. `site/`에서 API key를 Worker Secret으로 등록한다. 명령 입력값은 화면·로그·파일에 남기지 않는다.

   ```powershell
   npx wrangler secret put OPENAI_API_KEY
   ```

4. `automation`, `403`, 근거 없는 합성 질문으로 generated·retrieval fallback을 확인한다. 실제 환자·직원 정보를 질문에 사용하지 않는다.

생성 기능을 즉시 끄려면 Secret을 삭제한다. API는 자동으로 retrieval-only로 돌아간다.

```powershell
npx wrangler secret delete OPENAI_API_KEY
```

현재 기본 경계는 방문자당 6회/분, 전체 30회/분, 전체 200회/UTC 일이다. 변경 시 비용 추정과 ADR-0003을 함께 갱신한다. Cloudflare rate limiter는 abuse 방어용이며 정확한 비용 회계는 Durable Object 일일 budget과 OpenAI project 사용량 상한이 담당한다.

## GitHub 자동 배포

`.github/workflows/deploy-worker.yml`은 `main` push에서 배포한다. GitHub repository의 **Settings → Secrets and variables → Actions**에 `CLOUDFLARE_API_TOKEN`을 추가한다.

토큰은 Cloudflare의 **Edit Cloudflare Workers** 권한 템플릿을 사용하고, CCDOS를 운영하는 계정으로 범위를 제한한다. 토큰 값은 소스·문서·로그에 기록하지 않는다.

## 실패 시 확인 순서

1. `npm run cf:whoami`로 Cloudflare 인증과 계정을 확인한다.
2. `npm run typecheck`로 client와 Worker binding type을 확인한다.
3. `npm test`로 API fallback과 주요 모바일 흐름을 확인한다.
4. `npm run build`로 `site/dist/` 생성 여부를 확인한다.
5. `npm exec wrangler -- deploy --dry-run`으로 config, Durable Object migration과 asset 구성을 확인한다.
6. 배포 후 공개 사이트에서 승인 콘텐츠와 `/api/answer` fallback을 확인한다.

롤백은 Cloudflare dashboard의 Worker versions에서 이전 정상 버전을 선택해 수행한다. 배포 실패 로그에는 노트 본문이나 식별 가능 정보가 포함되지 않도록 한다.
