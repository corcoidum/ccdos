# Phase 0 완료 보고서 — Architecture Charter

**완료일:** 2026-07-10
**판정:** 통과

## 목표

자동화·웹 구현 전에 정보 소유권, 보안 경계, 콘텐츠 승인 규칙, 동기화와 복구의 분리를 확정한다.

## 생성 파일

- `README.md`, `.gitignore`, `.env.example`
- `docs/architecture/charter.md`
- `docs/architecture/architecture-model.json`
- `docs/architecture/repository-structure.md`
- `docs/architecture/risk-register.md`
- `docs/governance/{source-of-truth,security-classification,content-lifecycle,sync-backup-policy}.md`
- `docs/adr/0001-small-maintainable-stack.md`
- `scripts/verify_phase0.py`

## 확정된 결정

- 세 Vault는 물리적으로 분리하며, `ClinicOps-Local`은 외부 전송 경로를 갖지 않는다.
- 공개 콘텐츠는 `CORCOIDUM-Public`의 사람 승인 상태에서만 GitHub와 사이트로 이동한다.
- Discord는 제어·알림 수단이며 지식의 권위 원천이 아니다.
- 정적 웹·Markdown·Python 중심의 작은 교체 가능한 스택을 사용한다. 자세한 내용은 ADR-0001을 따른다.

## 실행한 검증

| 검증 | 명령 | 결과 |
| --- | --- | --- |
| 필수 문서·컴포넌트 소유권·제한 데이터 경로 | `python scripts/verify_phase0.py` | 통과* |
| Phase 0 검증 스크립트 문법 | `python -m py_compile scripts/verify_phase0.py` | 통과* |
| 아키텍처 모델 JSON | `python -c "... json.loads(...)"` | 통과* |

\* 기본 `python` 명령은 PATH에 없어서, 작업 환경에 포함된 Python 실행 파일로 실행했다. 세 명령은 exit code 0으로 완료됐다.

## 보안 점검

- 실제 환자·직원 데이터, 자격 증명, 웹훅 URL을 발견하거나 추가하지 않았다.
- `.gitignore`는 `.env`와 실제 `ClinicOps-Local` 경로를 제외한다.
- 모델 검증은 모든 필수 컴포넌트의 owner와 `S3_RESTRICTED → external` 흐름 부재를 검사한다.

## 남은 위험과 제한

- 실제 Obsidian Vault, frontmatter 스키마, privacy-pattern scanner, CI는 아직 구현하지 않았다.
- `.gitignore`만으로 로컬 민감 데이터 보호를 보장하지 않는다. Phase 1에서 경로·메타데이터 검증을 추가해야 한다.
- 외부 서비스 계정·배포 권한은 검증하지 않았다.

## 다음 조치

Phase 1에서 합성 데이터만 사용하여 세 Vault 예시 구조, 공통 메타데이터 스키마, 템플릿, 검증기와 테스트를 구현한다.
