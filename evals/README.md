# Grounding Eval

`grounding_eval.py`는 답변 계층의 **판단 품질**을 오프라인에서 회귀 검사한다. 고정된
질문·제공 근거·기대 동작과 metadata-only 응답 fixture를 비교하며, LLM·네트워크·배포
URL을 사용하지 않는다.

이 평가는 답변의 안전성, 완전성, 사실성 또는 의료적 타당성을 보장하지 않는다.
고정 케이스에서 `mode`, `reason`, 인용 범위가 계약을 지켰는지만 측정한다. 운영 안전
경계와 사람 검토는 계속 별도로 필요하다.

## 역할 분담

| 검사 | 목적 | 입력 |
|---|---|---|
| `automation/check_answer_layer.py` | 배포된 생성 계층의 상태 스모크 체크 | 배포 URL의 실제 응답 |
| `evals/grounding_eval.py` | 근거 유무에 따른 판단 품질 회귀 체크 | 로컬 고정 case/payload fixture |

## 구조

- `answer_grounding_cases.json`: 질문, 제공된 공개 source ID, 기대 mode/reason
- `fixtures/answer_payloads/<case-id>.json`: 응답 본문을 제외한 고정 mode/reason/citations
- `grounding_eval.py`: 로드, 정책 검증, 채점, 유형별 집계, 임계값 gate

응답 fixture에 `answer` 본문을 저장하지 않는다. 채점기는 fixture에 불필요한 필드가
있더라도 읽거나 출력하지 않는다.

## 실행

```bash
python evals/grounding_eval.py --min-pass 1.0
python -m unittest discover -s tests -v
```

전체 통과율이 `--min-pass`보다 낮으면 exit 1이다. `out-of-scope`는 안전 핵심 유형이므로
전체 임계값과 관계없이 단 한 건의 실패도 exit 1이다. 임계값이 1.0보다 낮아 비핵심
실패가 허용되면 `WARN`으로 구분해 출력한다.

## 케이스 추가 방법

1. `content/public/index.json`의 `notes` 또는 `glossary`에 실제 존재하는 승인 source ID를
   고른다. 비공개 vault의 내용이나 ID는 사용하지 않는다.
2. 공개 노트로 답할 수 있는 질문 또는 개인·환자 정보를 전혀 포함하지 않은 합성 질문을
   `answer_grounding_cases.json`에 추가한다.
3. `kind`는 아래 닫힌 집합 중 하나만 사용한다.
   - `grounded-answerable`
   - `out-of-scope`
   - `partial-evidence`
   - `empty-index`
4. 같은 ID의 metadata-only payload를
   `fixtures/answer_payloads/<case-id>.json`에 추가한다.
5. 위 두 실행 명령으로 유형별 통과율과 전체 테스트를 확인한다.

loader는 `provided_sources`가 현재 공개 index에 없으면 ID 값을 로그에 노출하지 않고
즉시 실패한다. 빈 케이스셋과 알 수 없는 `kind`도 구성 오류로 실패한다.

> TODO: payload를 case JSON에 inline으로 허용할지는 별도 review에서 결정한다. 현재는
> 명세의 case 예시가 입력과 기대값만 포함하고 기존 fixture 분리 관례가 있으므로 별도
> 파일만 지원한다.
