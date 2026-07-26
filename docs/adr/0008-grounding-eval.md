# ADR-0008: Grounding Eval로 답변 계층 판단 품질 측정

**상태:** 승인됨

**날짜:** 2026-07-26

> 저장소에는 이미 `0008-public-glossary-nodes.md`가 있다. 이 문서는 통합 명세가 요구한
> 파일명과 식별자를 보존한다. 후속 ADR registry 정리 시 번호 충돌을 별도로 해소한다.

## 맥락

ADR-0002는 승인된 공개 근거가 있을 때만 생성하고, 일치하는 근거가 없으면
retrieval-only로 폴백하라는 출력 경계를 정했다. `automation/check_answer_layer.py`는
배포된 endpoint의 `mode`와 `reason`을 읽어 생성 계층이 reachable한지, 의도된 throttle인지,
설정 또는 provider 장애인지 구분한다. 그러나 근거 밖 질문에 생성 계층이 답을 만들어
냈는지는 판단하지 않는다.

따라서 배포 상태가 정상이어도 "근거가 없으면 생성하지 않는다"는 ADR-0002의 핵심 약속이
회귀할 수 있다. 이 약속을 코드 경로 하나의 존재가 아니라 반복 가능한 측정으로 지킬
오프라인 gate가 필요하다.

Anthropic의 `misc/building_evals.ipynb`와 `misc/generate_test_cases.ipynb`에서
케이스셋 → 실행 → 채점 → 임계값 gate라는 평가 패턴만 참고했다. notebook 코드나
콘텐츠는 복사하지 않고, 외부 package도 추가하지 않은 채 Python stdlib로 번역한다.

## 결정

- `evals/answer_grounding_cases.json`을 검토 가능한 고정 케이스셋으로 둔다.
- 케이스는 `grounded-answerable`, `out-of-scope`, `partial-evidence`, `empty-index`의
  닫힌 유형 집합을 사용한다.
- 실제 생성은 수행하지 않는다. `evals/fixtures/answer_payloads/`에 응답 본문을 제외한
  고정 `mode`, `reason`, `citations` projection만 저장한다.
- scorer는 mode 일치, 기대 reason 일치, generated 응답의 non-empty citations가
  `provided_sources`의 부분집합인지를 검사한다.
- `provided_sources`는 빌드된 `content/public/index.json`의 승인 ID만 허용한다.
  index에 없는 ID는 값 자체를 출력하지 않고 load 단계에서 거부한다.
- 유형별 통과율과 전체 통과율을 출력한다. 전체 통과율이 `--min-pass`보다 낮으면 exit 1,
  `out-of-scope` 개별 실패는 전체 임계값과 무관하게 exit 1이다.
- 응답 본문 텍스트는 fixture, 로그, 결과에 저장하거나 출력하지 않는다.
- 구현은 `argparse`, `dataclasses`, `json`, `pathlib`, `unittest` 등 stdlib만 사용한다.

## 역할 분담

| 계층 | 질문 | 실패가 의미하는 것 |
|---|---|---|
| `check_answer_layer.py` | 배포된 답변 계층이 정상 상태인가? | 설정·provider·인프라 또는 smoke query 문제 |
| `grounding_eval.py` | 고정 근거 조건에서 기대한 생성/폴백 판단을 하는가? | 답변 계층 판단 계약의 회귀 |

두 검사는 대체 관계가 아니다. 첫 검사는 배포 상태를 실제 endpoint에서 확인하고, 두 번째
검사는 네트워크 없이 판단 품질을 결정론적으로 측정한다.

## 경계

- 실제 LLM, OpenAI API, 외부 network, 배포 URL을 호출하지 않는다.
- cookbook 코드, notebook, dependency, submodule을 저장소에 들이지 않는다.
- 비공개 vault의 내용이나 ID를 케이스셋에 사용하지 않는다.
- `automation/check_answer_layer.py`, Worker, `site/`의 동작을 변경하지 않는다.
- 이 평가는 고정 케이스에 대한 회귀 측정일 뿐 안전을 보장하지 않는다. 새 질문,
  잘못된 공개 근거, 답변 본문의 사실성, 의료 판단은 이 gate의 측정 범위 밖이며 사람
  검토와 runtime 경계가 계속 필요하다.

## 결과

CI는 unit test 뒤에 `python evals/grounding_eval.py --min-pass 1.0`을 실행한다. 근거 밖
질문에 generated payload가 기록되거나, generated payload가 제공되지 않은 source를
인용하거나, 케이스 구성이 승인 공개 경계를 벗어나면 배포 전 회귀 gate가 실패한다.

경고와 실패는 구분한다. 설정한 전체 임계값이 일부 비핵심 실패를 허용할 때는 `WARN`을
출력하지만, 임계값 미달과 모든 `out-of-scope` 실패는 `FAIL`과 exit 1이다.
