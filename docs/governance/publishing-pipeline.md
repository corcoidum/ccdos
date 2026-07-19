# 승인된 공개 콘텐츠 빌드·발행 규칙

## 입력과 출력

- 입력은 `vaults/CORCOIDUM-Public/`의 Markdown뿐이다.
- `approved` 또는 `published` 상태이며 검증을 통과한 노트만 `content/public/index.json`에 포함한다.
- 같은 승인 집합의 공개 metadata와 사람이 선언한 note 관계만 `content/public/graph.json`에 포함한다.
- `draft`, `review`, `archived` 노트는 공개 빌드에서 제외한다.
- 빌드는 본문을 정리하거나 해석하지 않는다. review와 validator가 통과시킨 내용을 정적 index로 변환할 뿐이다.
- 노트 ID는 Public Vault 전체에서 유일해야 하며, 단독 build 실행도 중복 ID를 차단한다.
- `published_at`은 `approved_at`보다 빠를 수 없고, 공개 index는 게시 시각을 우선해 정렬한다.

## 로컬 실행

```powershell
python automation/build_public_content.py
python automation/build_public_content.py --check
python automation/build_public_graph.py
python automation/build_public_graph.py --check
```

content build는 index를 생성하고 `--check`는 현재 Public Vault와 일치하는지 확인한다. graph build는 현재 index가 먼저 일치할 때만 실행되며, graph `--check`는 schema와 source 일치를 함께 검사한다. Pull Request에서는 두 check가 모두 통과해야 한다.

## CI gate와 수동 대체

`.github/workflows/public-content-gate.yml`은 Public Vault·검증기·생성물 변경 시 architecture 검사, Public 노트 검사, content index 검사, graph 검사, 단위 테스트, frontend 검사를 순서대로 실행한다. 이 workflow는 배포하거나 외부 서비스에 데이터를 보내지 않는다.

CI가 중단되면 [공개 콘텐츠 검토 규칙](public-content-review.md)의 checklist를 완료한 뒤 로컬 검증과 두 build를 수행하고, 생성된 `content/public/index.json`과 `content/public/graph.json`을 Pull Request에 포함한다.
