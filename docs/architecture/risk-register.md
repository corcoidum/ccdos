# 초기 위험 등록부

| ID | 위험 | 영향 | 완화·중단 기준 | 소유자 |
| --- | --- | --- | --- | --- |
| R-01 | 식별 가능 의료·직원 정보 유입 | 매우 높음 | 발견 즉시 저장·전송 중단, 저장소에 기록하지 않음 | Maintainer |
| R-02 | Local Vault의 외부 동기화 | 매우 높음 | 경로 분리·외부 sync 제외·정기 점검 | Maintainer |
| R-03 | 비승인·검토 후 변경된 콘텐츠 또는 AI 콘텐츠의 자동 공개 | 높음 | review 증적·현재 검토 버전·사람 승인 없이는 배포 차단 | Publishing owner |
| R-04 | 웹훅·API 키 노출 | 높음 | `.env` 제외, Secret 사용, 로그 마스킹 | Automation owner |
| R-05 | 동기화를 백업으로 오인 | 중간 | 독립 백업·복원 훈련·runbook | Maintainer |
| R-06 | 자동화 실패를 알지 못함 | 중간 | 구조화 로그, 재시도, Discord 비식별 알림 | Automation owner |
| R-07 | 불필요한 복잡성 | 중간 | ADR·최소 의존성·단계별 검증 | Maintainer |
| R-08 | Discord 상태 메시지에 공개 범위 밖의 내용 포함 | 높음 | 본문·식별자 미포함 summary만 생성, webhook host 검증, Secret 없으면 전송 안 함 | Automation owner |
| R-09 | LLM Wiki가 비승인·비공개 자료를 검색하거나 근거 없이 답변 | 높음 | approved Public index만 allowlist, 출처 표시, LLM은 별도 승인 전 비활성화 | RAG owner |

모든 Phase는 이 등록부를 갱신하고, R-01 또는 R-02가 발생하면 해당 Phase를 멈춘다.
