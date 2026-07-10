# CCDOS Cloudflare Workers 배포 Runbook

## 배포 방식

이 프로젝트는 Cloudflare **Workers Static Assets**를 사용한다. Vite가 생성한 `site/dist/`를 Worker 이름 `ccdos`에 배포하며, 계정의 Workers 서브도메인이 `corcoidum.workers.dev`라면 공개 주소는 `https://ccdos.corcoidum.workers.dev`다.

`wrangler.jsonc`은 SPA fallback과 observability를 설정하며, 비밀값·API key·환자 관련 데이터는 포함하지 않는다.

## 최초 로컬 배포

1. Cloudflare 대시보드에 로그인할 수 있는 계정으로, interactive terminal에서 아래 명령을 실행한다.

   ```powershell
   cd site
   npm run cf:whoami
   npx wrangler login
   npm run cf:whoami
   ```

2. 저장소 루트에서 승인 콘텐츠 index가 최신인지 확인한다.

   ```powershell
   python automation/build_public_content.py --check
   ```

3. 사이트를 빌드하고 배포한다.

   ```powershell
   cd site
   npm run deploy
   ```

## GitHub 자동 배포

`.github/workflows/deploy-worker.yml`은 `main` push에서 배포한다. GitHub repository의 **Settings → Secrets and variables → Actions**에 `CLOUDFLARE_API_TOKEN`을 추가한다.

토큰은 Cloudflare의 **Edit Cloudflare Workers** 권한 템플릿을 사용하고, CCDOS를 운영하는 계정으로 범위를 제한한다. 토큰 값은 소스·문서·로그에 기록하지 않는다.

## 실패 시 확인 순서

1. `npm run cf:whoami`로 Cloudflare 인증과 계정을 확인한다.
2. `npm run build`로 `site/dist/` 생성 여부를 확인한다.
3. `npm exec wrangler -- deploy --dry-run`으로 config와 asset 구성을 확인한다.
4. 배포 후 `https://ccdos.corcoidum.workers.dev`를 열어 빈 상태 또는 승인 콘텐츠가 정상 표시되는지 확인한다.

롤백은 Cloudflare dashboard의 Worker versions에서 이전 정상 버전을 선택해 수행한다. 배포 실패 로그에는 노트 본문이나 식별 가능 정보가 포함되지 않도록 한다.
