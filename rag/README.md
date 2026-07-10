# Phase 7 Public Wiki / RAG MVP

이 MVP는 `content/public/index.json`에 있는 `approved`·`published` 노트만 검색한다. Core, ClinicOps-Local, draft, review, archived 노트는 읽거나 인덱싱하지 않는다.

```powershell
python rag/search_public_wiki.py "automation"
```

결과에는 근거 노트의 `id`, 제목, 갱신 시각, tag, 짧은 공개 본문 발췌만 포함된다. 현재 단계는 retrieval-only이므로 LLM이 근거 없이 답변을 만들어 내지 않는다.

LLM을 추가할 경우에도 검색 결과의 출처 목록을 반드시 표시하고, 생성 결과는 `CORCOIDUM-Core/_AI_Staging/`에서 사람 검토를 거친 뒤에만 Public 후보로 승격한다. 검색어·출처·응답을 외부 LLM에 보낼지 여부는 별도 provider·비용·privacy 승인 후 결정한다.
