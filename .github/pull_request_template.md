## 무엇을, 왜

<!-- 공개 대상이 바뀌는 이유를 한 문장으로. 식별 가능한 원문이나 민감한 세부사항은 쓰지 않습니다. -->

## 검증

<!-- 실행한 검사와 결과. 예) python automation/validate_notes.py vaults/CORCOIDUM-Public → PASS -->

## 공개 노트 검토 체크

`vaults/CORCOIDUM-Public/`의 노트를 추가하거나 고치는 PR에만 해당합니다. 해당이 없으면 이 절을 지웁니다.
기준 문서는 [`docs/governance/public-content-review.md`](https://github.com/corcoidum/ccdos/blob/main/docs/governance/public-content-review.md)입니다. 하나라도 확신할 수 없으면 승인하지 않고 `draft`로 둡니다.

- [ ] 실제 환자·보호자·직원 이름, 연락처, 주민등록번호, 차트번호가 없다.
- [ ] 진료 결과, 일정, 희귀한 사건 조합처럼 재식별 가능한 운영 맥락이 없다.
- [ ] API key, token, password, 내부 URL·계정 정보가 없다.
- [ ] Core·ClinicOps 원문을 자동 복사하거나 그대로 인용하지 않았고, 공개용으로 독립 작성했다.
- [ ] 출처·인용·이미지 사용 권한을 확인했다.
- [ ] 제목, 태그, 본문, 링크와 frontmatter를 모두 검토했다.
