export type PhaseStatus = "GROWING" | "PASSED" | "VALIDATED" | "VERIFIED" | "LIVE";

export type PhaseEvidence = {
  label: string;
  href: string;
};

export type PhaseDefinition = {
  id: string;
  title: string;
  summary: string;
  status: PhaseStatus;
  purpose: string;
  delivered: readonly string[];
  boundaries: readonly string[];
  evidence: readonly PhaseEvidence[];
  outcome: string;
};

const repository = "https://github.com/corcoidum/ccdos";

// 상세 내용은 공개 completion report와 governance 문서로 확인할 수 있는 사실만 담는다.
export const phaseDefinitions: readonly PhaseDefinition[] = [
  {
    id: "0",
    title: "Architecture Charter",
    summary: "목적·책임·보안 경계와 중단 조건 정의",
    status: "PASSED",
    purpose:
      "자동화와 공개 웹을 만들기 전에 정보 소유권, 민감 데이터 경계, 승인 규칙과 복구 책임을 먼저 확정했습니다.",
    delivered: [
      "세 Vault의 소유권과 허용 데이터 흐름을 architecture model로 선언",
      "보안 분류, source of truth, lifecycle, sync·backup 정책 문서화",
      "제한 데이터가 외부로 흐르지 않는지 검사하는 Phase 0 validator 추가",
    ],
    boundaries: [
      "ClinicOps-Local은 GitHub, Discord, Cloudflare와 외부 LLM으로 전달하지 않음",
      "공개 콘텐츠는 CORCOIDUM-Public에서 사람이 승인한 경우에만 이동",
    ],
    evidence: [
      {
        label: "Phase 0 완료 보고서",
        href: `${repository}/blob/main/docs/architecture/phase-0-completion-report.md`,
      },
      {
        label: "Architecture Charter",
        href: `${repository}/blob/main/docs/architecture/charter.md`,
      },
    ],
    outcome: "이후 모든 Phase가 넘지 않아야 할 privacy와 ownership 경계를 먼저 세웠습니다.",
  },
  {
    id: "1",
    title: "Safe Knowledge Foundation",
    summary: "Vault·metadata·민감 패턴 검증 기반",
    status: "PASSED",
    purpose:
      "실제 민감 데이터를 사용하지 않고도 Vault 분리, Markdown metadata와 자동 차단 규칙을 반복 검증할 기반을 만들었습니다.",
    delivered: [
      "세 Vault의 합성 예시와 공통 frontmatter schema·template 구성",
      "Vault별 classification·visibility·공개 상태 규칙 강제",
      "민감 패턴과 잘못된 승인 metadata를 차단하는 Python validator와 단위 테스트 추가",
    ],
    boundaries: [
      "저장소의 ClinicOps-Local.example에는 합성 데이터만 사용",
      "패턴 검사는 사람의 privacy review를 대체하지 않음",
    ],
    evidence: [
      {
        label: "Phase 1 완료 보고서",
        href: `${repository}/blob/main/docs/architecture/phase-1-completion-report.md`,
      },
      { label: "Note schema", href: `${repository}/tree/main/schemas` },
    ],
    outcome: "공개 후보가 사람 검토에 도달하기 전에 명백한 metadata·privacy 오류를 차단할 수 있게 됐습니다.",
  },
  {
    id: "2",
    title: "Public Review Foundation",
    summary: "사람의 review checklist와 승인 증적",
    status: "PASSED",
    purpose:
      "공개 전 Privacy Review와 승인 증적을 명시하고, 검토 후 수정된 기록이 이전 승인을 재사용하지 못하게 했습니다.",
    delivered: [
      "공개 전 review checklist와 수동 대체 절차 문서화",
      "reviewer·reviewed_at·reviewed_revision 등 승인 증적 계약 추가",
      "reviewed_revision과 updated가 다르면 공개 상태를 거부하는 회귀 테스트 추가",
    ],
    boundaries: [
      "사람의 privacy 판단을 자동화하거나 건너뛰지 않음",
      "승인·발행 기록을 수정하면 재검토와 새 승인 증적이 필요",
    ],
    evidence: [
      {
        label: "Phase 2 완료 보고서",
        href: `${repository}/blob/main/docs/architecture/phase-2-completion-report.md`,
      },
      {
        label: "Public Content Review 정책",
        href: `${repository}/blob/main/docs/governance/public-content-review.md`,
      },
    ],
    outcome: "공개 여부가 파일 위치나 작성자의 의도보다 현재 revision의 사람 승인 증적으로 결정됩니다.",
  },
  {
    id: "3",
    title: "Public Content CI Gate",
    summary: "PR과 main에서 metadata·privacy·architecture 규칙 강제",
    status: "VALIDATED",
    purpose:
      "로컬에서만 실행되던 공개 경계 검사를 Pull Request와 main의 필수 자동 검증으로 연결했습니다.",
    delivered: [
      "architecture boundary와 Public Vault metadata·privacy 검사를 GitHub Actions에 연결",
      "Python automation test와 frontend build를 같은 gate에서 실행",
      "검증 실패 시 다음 publishing·deployment 단계로 진행하지 않는 순서 확립",
    ],
    boundaries: [
      "CI는 승인 증적의 존재와 일관성을 확인하지만 사람의 검토 내용을 생성하지 않음",
      "Secret, private Vault와 실제 민감 데이터는 runner 입력으로 사용하지 않음",
    ],
    evidence: [
      {
        label: "Phase 3·4 완료 보고서",
        href: `${repository}/blob/main/docs/architecture/phase-3-4-completion-report.md`,
      },
      {
        label: "Public content gate workflow",
        href: `${repository}/blob/main/.github/workflows/public-content-gate.yml`,
      },
    ],
    outcome: "공개 경계가 개인의 기억이 아니라 반복 실행되는 merge gate로 유지됩니다.",
  },
  {
    id: "4",
    title: "Approved Publishing Pipeline",
    summary: "승인된 콘텐츠만 deterministic artifact로 전달",
    status: "VALIDATED",
    purpose:
      "Markdown 원본 중 approved·published 기록만 공개 index로 만들고 source와 artifact의 불일치를 배포 전에 차단했습니다.",
    delivered: [
      "승인된 Public note만 content/public/index.json으로 만드는 builder 추가",
      "draft·review 제외와 duplicate ID·stale artifact 차단",
      "public graph build보다 public content gate가 먼저 통과하도록 CI 순서 고정",
    ],
    boundaries: [
      "생성 JSON은 파생 artifact이며 Markdown이 계속 권위 원천",
      "builder는 approval evidence를 생성하거나 수정하지 않음",
    ],
    evidence: [
      {
        label: "Publishing Pipeline 정책",
        href: `${repository}/blob/main/docs/governance/publishing-pipeline.md`,
      },
      {
        label: "Public content builder",
        href: `${repository}/blob/main/automation/build_public_content.py`,
      },
    ],
    outcome: "같은 승인 원본에서 같은 공개 artifact를 재현하고 stale 결과의 배포를 막을 수 있게 됐습니다.",
  },
  {
    id: "5",
    title: "Public OS UI",
    summary: "OS·Garden·Lab·Projects 공개 화면",
    status: "LIVE",
    purpose:
      "승인된 공개 콘텐츠와 프로젝트 증거를 외부 API 없이 읽을 수 있는 정적 OS 경험으로 연결했습니다.",
    delivered: [
      "Vite + TypeScript 기반 OS·Garden·Lab·Projects SPA 구축",
      "승인된 public index만 import하고 draft·review는 렌더링하지 않는 구조 적용",
      "desktop과 mobile responsive layout 및 빈 상태 검증",
    ],
    boundaries: [
      "사이트가 private/local Vault를 읽지 않음",
      "외부 analytics, Markdown HTML renderer와 새로운 server database를 사용하지 않음",
    ],
    evidence: [
      {
        label: "Phase 5 완료 보고서",
        href: `${repository}/blob/main/docs/architecture/phase-5-completion-report.md`,
      },
      { label: "현재 OS 화면", href: "https://openkiki.org/os" },
    ],
    outcome: "검토된 기록과 구현 증거를 하나의 공개 가능한 사용자 경험으로 제공하게 됐습니다.",
  },
  {
    id: "6",
    title: "Automation & Discord",
    summary: "비식별 상태 보고와 선택적 webhook",
    status: "VERIFIED",
    purpose:
      "검증·배포 상태를 민감한 본문 없이 요약하고, 명시적으로 설정된 경우에만 Discord로 알리는 운영 자동화를 만들었습니다.",
    delivered: [
      "검사 결과와 공개 콘텐츠 개수만 포함하는 redacted status report 추가",
      "명시적 --send와 허용된 Discord webhook host를 요구하는 전송 경계 구현",
      "배포·주간 review workflow와 비식별 알림의 실제 운영 검증",
    ],
    boundaries: [
      "Discord는 알림 채널이며 지식의 권위 원천이 아님",
      "webhook URL, Secret과 공개 노트 본문을 status log에 출력하지 않음",
    ],
    evidence: [
      {
        label: "Phase 6 완료 보고서",
        href: `${repository}/blob/main/docs/architecture/phase-6-completion-report.md`,
      },
      {
        label: "Automation MVP Runbook",
        href: `${repository}/blob/main/docs/runbooks/automation-mvp.md`,
      },
    ],
    outcome: "공개 경계를 유지하면서 CI·deployment 상태를 운영 채널에서 확인할 수 있게 됐습니다.",
  },
  {
    id: "7",
    title: "Retrieval-only Public Wiki",
    summary: "외부 LLM 없이 승인된 출처 검색",
    status: "LIVE",
    purpose:
      "생성 모델을 연결하기 전에 승인된 공개 기록만 찾고 citation-ready 결과를 반환하는 검색 경계를 먼저 검증했습니다.",
    delivered: [
      "approved·published public index만 검색하는 Python RAG MVP 구현",
      "출처 ID·제목·갱신 시각·tag·본문 발췌를 포함한 결과 계약 정의",
      "Lab에서 같은 공개 index를 브라우저 안에서 검색하는 체험 제공",
    ],
    boundaries: [
      "검색 과정은 외부 LLM을 호출하거나 검색어·근거를 외부로 전송하지 않음",
      "미승인·비공개 문서는 검색 결과에 포함하지 않음",
    ],
    evidence: [
      {
        label: "Phase 7 완료 보고서",
        href: `${repository}/blob/main/docs/architecture/phase-7-completion-report.md`,
      },
      { label: "Lab 검색 체험", href: "https://openkiki.org/lab" },
    ],
    outcome: "Grounded Answer Layer가 사용할 수 있는 승인 근거 선택과 인용 기반을 생성 없이 먼저 확보했습니다.",
  },
  {
    id: "8",
    title: "Grounded Answer Layer",
    summary: "승인 근거 안에서만 동작하는 선택적 AI 답변",
    status: "LIVE",
    purpose:
      "공개 검색 근거를 자연어로 요약하되, provider·비용·인용·실패 경계를 Worker에서 강제했습니다.",
    delivered: [
      "Worker가 최대 3개의 승인 출처를 다시 선택하는 /api/answer 구현",
      "허용 source ID 인용이 없는 생성 결과를 폐기하는 citation policy 추가",
      "rate limit·일일 budget·timeout·provider 오류의 retrieval-only fallback 구현",
    ],
    boundaries: [
      "외부 전송은 방문자 질문과 S0_PUBLIC 발췌로 제한",
      "의료 판단을 수행하지 않고 Secret과 IP를 application log에 저장하지 않음",
    ],
    evidence: [
      {
        label: "Phase 8 완료 보고서",
        href: `${repository}/blob/main/docs/architecture/phase-8-completion-report.md`,
      },
      {
        label: "OpenAI provider ADR",
        href: `${repository}/blob/main/docs/adr/0003-openai-provider-migration.md`,
      },
    ],
    outcome: "생성이 불가능하거나 안전 조건을 만족하지 않아도 검색 근거를 잃지 않는 답변 계층이 운영됩니다.",
  },
  {
    id: "9",
    title: "Living Values",
    summary: "H.O.P.E · T.R.U.S.T · M.E.R.C.Y · L.O.V.E 공개 기록 축적",
    status: "GROWING",
    purpose:
      "Phase 0–8에서 만든 공개 시스템을 네 가지 가치가 실제로 드러나는 승인 기록으로 채우고 있습니다.",
    delivered: [
      "hope·trust·mercy·love 가치 tag의 의미와 적용 기준 정의",
      "Garden과 가치별 공간에서 승인 기록을 같은 tag로 탐색",
      "주 1–2편을 목표로 하되 발행 gate를 우선하는 운영 리듬 수립",
    ],
    boundaries: [
      "새 인프라 구축이 아니라 콘텐츠 축적 단계로 유지",
      "개인 서사도 같은 비식별·Privacy Review·사람 승인 gate를 통과",
    ],
    evidence: [
      {
        label: "Phase 9 계획과 완료 기준",
        href: `${repository}/blob/main/docs/architecture/phase-9-plan.md`,
      },
      { label: "Living Values 기록", href: "https://openkiki.org/garden" },
    ],
    outcome: "네 가치마다 승인·발행 기록 3편 이상이 쌓이기 전까지 GROWING 상태를 유지합니다.",
  },
];

export const phaseDefinitionsById: ReadonlyMap<string, PhaseDefinition> = new Map(
  phaseDefinitions.map((phase) => [phase.id, phase]),
);
