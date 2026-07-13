# Phase 7·8 Public Wiki / Grounded Answer Layer

이 MVP는 `content/public/index.json`에 있는 `approved`·`published` 노트만 검색한다. Core, ClinicOps-Local, draft, review, archived 노트는 읽거나 인덱싱하지 않는다.

```powershell
python rag/search_public_wiki.py "automation"
```

결과에는 근거 노트의 `id`, 제목, 게시·갱신 시각, tag, 짧은 공개 본문 발췌만 포함된다. CLI와 기본 Browser 검색은 retrieval-only다.

`site/src/worker.ts`의 `/api/answer`는 사용자가 AI 답변 생성을 명시적으로 선택할 때만 호출된다. Worker가 승인된 index에서 관련 출처를 다시 검색하고, 질문과 최대 3개 공개 발췌만 OpenAI Responses API에 전달한다. API 요청은 `store: false`로 처리하며, 허용된 ID 인용이 없는 응답은 폐기하고 retrieval-only 결과로 폴백한다.

생성 결과를 Public 콘텐츠로 재사용하려면 `CORCOIDUM-Core/_AI_Staging/`에서 사람 검토를 거친 뒤에만 Public 후보로 승격한다. 실제 환자·직원 정보나 비공개 운영 자료를 질문에 입력하지 않는다.
