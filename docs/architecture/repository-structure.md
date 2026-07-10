# 저장소 구조 계획

```text
.
├─ docs/                     # 현재 Phase 0 문서와 이후 운영 문서
│  ├─ architecture/
│  ├─ adr/
│  ├─ governance/
│  ├─ runbooks/
│  └─ case-study/
├─ vaults/                   # Phase 1 완료: 예시 Vault만, 실제 민감 Vault 금지
├─ schemas/                  # Phase 1 완료: frontmatter 스키마
├─ templates/                # Phase 1 완료: Obsidian 템플릿
├─ content/                  # Phase 4+: 승인된 공개 콘텐츠
├─ site/                     # Phase 5: Vite 웹사이트
├─ automation/               # Phase 1: validators; 이후 publishing, discord, weekly-review
├─ rag/                      # Phase 7: 승인 원본 RAG MVP
├─ tests/ fixtures/          # Phase별 합성 테스트
├─ workflows/                # 선택적인 n8n 내보내기
├─ scripts/                  # 저장소 검증 스크립트
└─ .github/workflows/        # Phase 4+: CI/CD
```

`vaults/ClinicOps-Local/`은 `.gitignore`로 제외하며, 실제 데이터나 운영 기록을 생성하지 않는다. 버전 관리되는 `vaults/ClinicOps-Local.example/`은 합성 예시 전용이다.
