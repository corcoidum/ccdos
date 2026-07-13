# ADR-0003: Grounded Answer Layer의 OpenAI 전환

**상태:** 승인됨

**날짜:** 2026-07-14

**대체:** ADR-0002의 provider 결정

## 맥락

ADR-0002에서 정한 승인 출처·인용·비용·키·롤백 경계는 그대로 유효하다. Production credential을 단일화하기 위해 사용자가 OpenAI API key 사용을 결정했고, Cloudflare Worker에 `OPENAI_API_KEY`를 Secret으로 등록했다.

## 결정

- provider는 OpenAI Responses API로 변경한다.
- 기본 모델은 짧고 잘 정의된 grounded 요약에 적합한 `gpt-5.4-mini`로 한다.
- 외부 전송은 질문과 최대 3개의 승인된 S0_PUBLIC 발췌로 제한한다.
- API 요청은 `store: false`로 보내며, 허용된 source ID 인용을 통과한 응답만 사용자에게 반환한다.
- Secret 부재, 근거 부재, rate limit, budget 소진, timeout, provider 오류, 인용 실패 시 retrieval-only로 폴백한다.
- API key는 `wrangler.jsonc`이나 Git에 저장하지 않고 Cloudflare Worker Secret으로만 관리한다.

## 결과

기존 UI와 검색 경계는 유지하면서 credential과 provider가 OpenAI로 통일된다. 모델은 `OPENAI_MODEL` 설정으로 교체할 수 있으며, 변경 시 합성 질문으로 citation·fallback 회귀 검증을 수행한다.
