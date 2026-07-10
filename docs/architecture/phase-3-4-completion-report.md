# Phase 3·4 완료 보고서 — CI Gate와 Publishing Pipeline

**완료일:** 2026-07-10
**판정:** 로컬 검증 완료, GitHub 실행 대기

## 구현 결과

- Pull Request와 `main`·`master` push에서 Public Vault를 검사하는 GitHub Actions workflow를 추가했다.
- `automation/build_public_content.py`는 검증을 통과한 `approved`·`published` 노트만 `content/public/index.json`으로 생성한다.
- CI는 생성된 index가 최신인지 `--check`로 확인한다. 이 단계에서는 배포·웹훅·외부 전송을 수행하지 않는다.
- 합성 단위 테스트로 draft 제외와 stale index 차단을 확인했고, site의 Vite build도 CI에서 검사한다.

## 남은 외부 확인

GitHub 원격 저장소와 첫 commit이 아직 없으므로 Actions workflow의 실제 runner 실행과 branch protection 설정은 아직 확인할 수 없다. 첫 Pull Request에서 workflow를 실행하고, required check로 지정해야 한다.
