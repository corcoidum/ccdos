# Phase 8 완료 보고서 — Retrieval UX와 Grounded Answer Layer

**완료일:** 2026-07-14

**판정:** Phase 8a·8b 구현·production 활성화 완료

## 구현 결과

- Garden은 필터 결과의 처음 2개 기록만 기본 표시하고, 접근 가능한 더보기·접기 버튼을 제공한다.
- `/os` → `/garden` → `/lab` → `/projects` 순서의 touch·trackpad navigation을 앱이 직접 처리한다.
- Browser retrieval은 계속 로컬에서만 동작하며 승인된 Public index만 검색한다.
- `/api/answer`는 Worker가 관련 승인 출처를 다시 선택하므로 client가 source 경계를 변경할 수 없다.
- OpenAI 응답에 허용된 source ID 인용이 없거나 잘못된 인용이 있으면 생성 결과를 폐기한다.
- Secret 부재, rate limit, 일일 budget, timeout, provider 오류 시 retrieval-only로 폴백한다.
- Playwright smoke test가 route, Garden disclosure/filter, touch·wheel navigation, API·UI 폴백을 검증한다.

## 운영 경계

- 외부 전송 허용값은 방문자 질문과 최대 3개의 S0_PUBLIC 발췌뿐이다.
- IP는 Cloudflare rate-limit key로만 사용하며 application log나 응답에 기록하지 않는다.
- API key는 Cloudflare Worker Secret으로만 보관한다.
- 생성 기능은 운영 지원과 공개 지식 요약용이며 의료 진단·치료 결정을 수행하지 않는다.

## 운영 후속 조치

1. OpenAI project에서 월 사용량 알림·상한과 API key rotation 정책을 유지한다.
2. Worker의 `OPENAI_API_KEY` Secret 존재 여부만 확인하고 값은 로그·문서에 노출하지 않는다.
3. 합성 질문으로 citation·fallback을 확인한 뒤 observability에서 429와 provider 오류 비율을 관찰한다.
