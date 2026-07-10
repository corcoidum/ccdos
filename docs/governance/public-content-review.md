# 공개 콘텐츠 Privacy Review와 변경 이력 규칙

## 적용 범위

이 절차는 `vaults/CORCOIDUM-Public/`의 `review`, `approved`, `published` 노트에 적용한다. 검증기는 누락된 증적과 상태·시각의 명백한 모순을 차단하지만, 개인정보 여부를 판정하거나 사람 검토를 대체하지 않는다.

## 검토 절차

1. 작성자는 Core 원문을 복사하지 않고, Public Vault에 독립적인 `draft` 문서를 작성한다.
2. 작성자는 민감 정보, 식별 가능한 사례 맥락, 비밀값, 외부 비공개 원문 인용이 없는지 확인한다.
3. 검토 요청 시 `publish_state: review` 및 `review_requested_at`을 기록한다.
4. 검토자는 아래 체크리스트를 확인한다. 통과한 경우에만 `privacy_reviewed_by`, `privacy_reviewed_at`, `privacy_review_result: passed`, `reviewed_revision`을 기록한다.
5. 승인자는 검토 기록과 diff를 확인하고 `approved_by`, `approved_at`, `publish_state: approved`를 기록한다.
6. CI와 발행 단계는 `approved` 문서만 소비한다. 배포가 성공하면 `published_at`을 기록한다.

## Privacy Review 체크리스트

- [ ] 실제 환자·보호자·직원 이름, 연락처, 주민등록번호, 차트번호가 없다.
- [ ] 진료 결과, 일정, 희귀한 사건 조합처럼 재식별 가능한 운영 맥락이 없다.
- [ ] API key, token, password, 내부 URL·계정 정보가 없다.
- [ ] Core·ClinicOps 원문을 자동 복사하거나 그대로 인용하지 않았고, 공개용으로 독립 작성했다.
- [ ] 출처·인용·이미지 사용 권한을 확인했다.
- [ ] 제목, 태그, 본문, 링크와 frontmatter를 모두 검토했다.

하나라도 확신할 수 없으면 승인하지 않고 `draft`로 되돌린다. 실제 또는 의심되는 식별 가능 의료·직원 정보는 이 저장소에 기록하지 않고 즉시 작업을 중단한다.

## 변경 이력 규칙

- `reviewed_revision`은 검토한 문서 버전을 나타내며, 정확히 현재 `updated` 값과 일치해야 한다.
- 승인 또는 발행 뒤 제목·frontmatter·본문·링크를 수정하면 `updated`를 변경하고 `publish_state: draft`로 되돌린다. 이전 review·approval 증적은 재사용하지 않는다.
- 의미 있는 수정에는 Pull Request 설명 또는 커밋 메시지에 공개 대상 변경 이유를 한 문장으로 남긴다. 식별 가능 원문이나 민감 세부사항은 변경 이력에 쓰지 않는다.
- 검토자와 승인자는 서로 다른 사람이 이상적이지만, 1인 운영에서는 동일 인물이 수행할 수 있다. 이 경우에도 두 시각과 검토 체크리스트를 남긴다.

## 수동 대체와 감사

자동화가 중단되면, 작성자는 로컬에서 `python automation/validate_notes.py vaults/CORCOIDUM-Public`를 실행하고 이 문서의 체크리스트를 사용해 검토한다. 실패 기록에는 노트 본문 대신 `id`, 실패한 규칙, 처리 시각만 남긴다.
