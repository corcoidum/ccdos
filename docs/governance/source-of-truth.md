# Source-of-Truth 책임 매트릭스

| 도메인 | 단일 권위 원천 | 변경 방식 | 외부 전송 조건 | 보존 원칙 |
| --- | --- | --- | --- | --- |
| ClinicOps-Local | 로컬 Obsidian Vault | 로컬 수동 편집 | 허용하지 않음 | 로컬 복구 사본만 |
| 개인 지식·초안 | CORCOIDUM-Core Vault | Obsidian·수동 검토 | 공개 후보로 승격할 때만 | 개인 동기화는 별도 정책 |
| 공개 콘텐츠 | CORCOIDUM-Public Vault | 승인된 Markdown/MDX | `approved` 메타데이터와 검증 통과 | Git 이력과 독립 백업 |
| 애플리케이션·자동화 | GitHub 저장소 | Pull Request / CI | 빌드 결과만 | Git 이력 + 릴리스 |
| 운영 상태·승인 요청 | Discord | 정해진 채널·웹훅 | 비식별 요약만 | 장기 지식 저장소로 사용 안 함 |
| 공개 표현 | openkiki.org | CI/CD 배포 | 승인된 정적 산출물만 | 원본은 Public Vault/Git에 보존 |

Discord 메시지나 웹사이트는 지식의 권위 원천이 아니다. 수정은 반드시 해당 권위 원천에서 수행한다.
