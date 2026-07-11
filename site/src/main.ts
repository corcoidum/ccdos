import content from "../../content/public/index.json";
import "./style.css";

type PublicNote = {
  id: string;
  title: string;
  updated: string;
  tags: string[];
  state: "approved" | "published";
  body: string;
};

type PublicContent = {
  version: number;
  notes: PublicNote[];
};

type Route = "/os" | "/garden" | "/lab" | "/projects";

type HeroAction = {
  label: string;
  href: string;
  style: "primary" | "secondary";
};

type HeroConfig = {
  routeName: string;
  kicker: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  actions: HeroAction[];
  note: string;
  showCredo?: boolean;
};

type RouteDefinition = {
  path: Route;
  label: string;
  title: string;
};

type RenderOptions = {
  announce?: boolean;
  restoreHistory?: boolean;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

const publicContent = content as PublicContent;
const routeDefinitions: RouteDefinition[] = [
  { path: "/os", label: "OS", title: "세계관과 시스템" },
  { path: "/garden", label: "Garden", title: "검토된 기록" },
  { path: "/lab", label: "Lab", title: "작은 실험" },
  { path: "/projects", label: "Projects", title: "결과와 증거" },
];
const routes = routeDefinitions.map(({ path }) => path);
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Application root is missing.");
}

const appRoot: HTMLDivElement = app;

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function currentRoute(): Route {
  const normalizedPath = window.location.pathname.replace(/\/$/, "") || "/os";
  return routes.includes(normalizedPath as Route) ? (normalizedPath as Route) : "/os";
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function supportsScrollDrivenAnimations(): boolean {
  return typeof CSS !== "undefined" && CSS.supports("animation-timeline", "view()");
}

function renderWithTransition(options: RenderOptions): void {
  const transitionDocument = document as ViewTransitionDocument;
  if (!prefersReducedMotion() && typeof transitionDocument.startViewTransition === "function") {
    transitionDocument.startViewTransition(() => render(options));
    return;
  }
  render(options);
}

function navigate(route: Route): void {
  if (window.location.pathname === route) {
    if (window.location.hash) {
      window.history.replaceState({}, "", route);
    }
    window.scrollTo({ top: 0, behavior: "auto" });
    return;
  }
  window.history.pushState({}, "", route);
  renderWithTransition({ announce: true });
}

function createRouteLink(route: Route, label: string, className: string): HTMLAnchorElement {
  const link = createElement("a", className, label);
  link.href = route;
  link.addEventListener("click", (event) => {
    if (!isPlainLeftClick(event)) {
      return;
    }
    event.preventDefault();
    navigate(route);
  });
  return link;
}

function createActionLink(action: HeroAction): HTMLAnchorElement {
  const link = createElement("a", `action-link action-link--${action.style}`, action.label);
  link.href = action.href;
  if (routes.includes(action.href as Route)) {
    link.addEventListener("click", (event) => {
      if (!isPlainLeftClick(event)) {
        return;
      }
      event.preventDefault();
      navigate(action.href as Route);
    });
  }
  return link;
}

function createExternalLink(href: string, label: string, className: string): HTMLAnchorElement {
  const link = createElement("a", className, label);
  link.href = href;
  link.target = "_blank";
  link.rel = "noreferrer";
  return link;
}

function formatDate(timestamp: string): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(timestamp),
  );
}

function createSectionHeading(eyebrow: string, title: string, description: string): HTMLElement {
  const heading = createElement("header", "section-heading");
  heading.append(
    createElement("p", "eyebrow", eyebrow),
    createElement("h2", undefined, title),
    createElement("p", "section-description", description),
  );
  return heading;
}

function createHero(config: HeroConfig): HTMLElement {
  const hero = createElement("section", `hero hero--${config.routeName}`);
  const copy = createElement("div", "hero-copy");
  copy.append(createElement("p", "eyebrow", config.kicker));
  if (config.showCredo) {
    copy.append(
      createElement(
        "p",
        "hero-credo",
        "Where codes and hearts coexist. The future of Tech is human.",
      ),
    );
  }
  const title = createElement("h1", undefined, config.title);
  title.id = "page-title";
  title.tabIndex = -1;
  copy.append(title, createElement("p", "hero-description", config.description));

  const actions = createElement("div", "hero-actions");
  config.actions.forEach((action) => actions.append(createActionLink(action)));
  copy.append(actions, createElement("p", "hero-note", config.note));

  const visual = createElement("figure", "hero-visual");
  const image = createElement("img");
  image.src = config.image;
  image.alt = config.imageAlt;
  image.width = 1536;
  image.height = 1024;
  image.decoding = "async";
  image.loading = "eager";
  image.setAttribute("fetchpriority", "high");
  visual.append(image);
  if (config.routeName === "os") {
    const constellationNav = createElement("nav", "constellation-nav");
    constellationNav.setAttribute("aria-label", "별자리 공간 바로가기");
    for (const [route, label, modifier] of [
      ["/os", "OS", "os"],
      ["/garden", "Garden", "garden"],
      ["/lab", "Lab", "lab"],
      ["/projects", "Projects", "projects"],
    ] as const) {
      const node = createRouteLink(route, label, `constellation-node constellation-node--${modifier}`);
      constellationNav.append(node);
    }
    visual.append(constellationNav);
  }

  hero.append(copy, visual);
  return hero;
}

function createJourneySteps(): HTMLOListElement {
  const steps = [
    ["01", "관찰", "사람과 현장의 맥락을 먼저 듣고, 줄여야 할 마찰을 발견합니다."],
    ["02", "지식", "검토와 학습을 통해 다시 사용할 수 있는 언어로 정리합니다."],
    ["03", "실험", "작은 가설을 세우고 합성 데이터로 빠르게 검증합니다."],
    ["04", "검토", "보안과 윤리, 사람에게 미칠 영향을 다시 확인합니다."],
    ["05", "공개", "가치와 근거가 확인된 결과만 책임 있게 연결합니다."],
  ] as const;
  const list = createElement("ol", "journey-steps");
  for (const [index, title, description] of steps) {
    const item = createElement("li", "journey-step");
    item.append(
      createElement("span", "step-index", index),
      createElement("h3", undefined, title),
      createElement("p", undefined, description),
    );
    list.append(item);
  }
  return list;
}

function renderOs(): HTMLElement {
  const page = createElement("div", "page page--os");
  page.append(
    createHero({
      routeName: "os",
      kicker: "CORCOIDUM OS · CREDO",
      title: "사람의 마음을 잃지 않은\n기술로, 복잡한 삶과 일을\n더 나은 흐름으로 바꾼다.",
      description:
        "늦게 다시 시작하더라도 배움을 멈추지 않고, 일과 가족, 기술과 인간다움이 함께 살아갈 수 있는 미래를 만듭니다.",
      image: "/assets/constellation-os.jpg",
      imageAlt:
        "심장을 중심으로 정원, 실험실, 나침반과 별들이 연결된 CORCOIDUM OS 별자리 지도",
      actions: [
        { label: "OS 여정 시작하기", href: "#journey", style: "primary" },
        { label: "Projects 보기", href: "/projects", style: "secondary" },
      ],
      note: "안전과 privacy review는 모든 여정의 기반입니다. 필요한 사람에게만, 필요한 만큼.",
      showCredo: true,
    }),
  );

  const journey = createElement("section", "content-section journey-section");
  journey.id = "journey";
  journey.tabIndex = -1;
  journey.append(
    createSectionHeading(
      "HOW THE SYSTEM FLOWS",
      "나의 시스템은 이렇게 흐릅니다.",
      "관찰에서 시작해 지식으로 쌓고, 작게 실험한 뒤 사람의 검토를 거쳐 세상과 연결합니다.",
    ),
    createJourneySteps(),
  );

  const values = createElement("section", "content-section values-section");
  values.append(
    createSectionHeading(
      "FOUR HUMAN PROMISES",
      "내가 지키려는 네 가지 약속",
      "기술의 속도보다 어떤 삶을 지키려는지 먼저 묻는 CORCOIDUM의 기준입니다.",
    ),
  );
  const valueList = createElement("div", "value-list");
  for (const [name, meaning, description] of [
    ["H.O.P.E", "성장 · 재시작 · 학습", "공백은 끝이 아니라 다시 배우기 위한 여백이 됩니다."],
    ["T.R.U.S.T", "명확한 사고 · 시스템 · 기술", "이해할 수 있고 검증 가능한 흐름으로 신뢰를 쌓습니다."],
    ["M.E.R.C.Y", "사람의 부담을 줄이는 기술", "자동화의 성공을 기능 수가 아니라 줄어든 부담으로 판단합니다."],
    ["L.O.V.E", "가족 · 일상 · 지속 가능성", "일과 가족, 건강과 성장이 함께 지속될 수 있어야 합니다."],
  ]) {
    const item = createElement("article", "value-item");
    item.append(
      createElement("p", "value-name", name),
      createElement("h3", undefined, meaning),
      createElement("p", undefined, description),
    );
    valueList.append(item);
  }
  values.append(valueList, createElement("p", "dur-note", "Ditch · Upgrade · Repeat — 버리고, 개선하고, 계절처럼 다시 시작합니다."));

  const portals = createElement("section", "content-section portal-section");
  portals.append(
    createSectionHeading(
      "EXPLORE THE LIVING OS",
      "생각에서 실험으로, 실험에서 증거로",
      "세 공간은 서로 분리된 메뉴가 아니라 한 사람의 배움이 자라는 연속된 여정입니다.",
    ),
  );
  const portalList = createElement("div", "portal-list");
  for (const [index, route, title, description] of [
    ["01", "/garden", "Garden", "사람의 검토를 통과한 생각과 기록이 자라는 곳"],
    ["02", "/lab", "Lab", "작은 가설을 만들고 실패와 배움을 정직하게 남기는 곳"],
    ["03", "/projects", "Projects", "검증된 결과와 구현의 증거를 세상과 연결하는 곳"],
  ] as const) {
    const link = createRouteLink(route, "", "portal-row");
    link.setAttribute("aria-label", `${title}: ${description}`);
    link.append(
      createElement("span", "portal-index", index),
      createElement("strong", undefined, title),
      createElement("span", "portal-description", description),
      createElement("span", "portal-action", "들어가기"),
    );
    portalList.append(link);
  }
  portals.append(portalList);

  page.append(journey, values, portals);
  return page;
}

function createLifecycle(): HTMLElement {
  const section = createElement("section", "content-section lifecycle-section");
  section.append(
    createSectionHeading(
      "A GARDEN WITH A GATE",
      "생각은 돌봄과 검토를 거쳐 자랍니다.",
      "빠르게 많이 공개하는 대신, 공개할 이유와 안전 경계를 확인한 기록만 이곳에 심습니다.",
    ),
  );
  const list = createElement("ol", "lifecycle-list");
  for (const [index, title, description] of [
    ["01", "초안", "관찰과 배움을 개인의 언어로 기록합니다."],
    ["02", "검토", "식별 정보와 맥락 손실, 공개 필요성을 확인합니다."],
    ["03", "승인", "사람의 책임 있는 판단과 증적을 남깁니다."],
    ["04", "공개", "승인된 내용만 정적 index와 웹으로 전달합니다."],
  ]) {
    const item = createElement("li");
    item.append(
      createElement("span", "step-index", index),
      createElement("h3", undefined, title),
      createElement("p", undefined, description),
    );
    list.append(item);
  }
  section.append(list);
  return section;
}

function createNoteCard(note: PublicNote): HTMLElement {
  const article = createElement("article", "note-entry");
  const meta = createElement("p", "note-meta");
  const time = createElement("time", undefined, formatDate(note.updated));
  time.dateTime = note.updated;
  meta.append(time, document.createTextNode(` · ${note.state}`));
  article.append(meta, createElement("h3", undefined, note.title));

  const tags = createElement("div", "tag-list");
  for (const tag of note.tags) {
    tags.append(createElement("span", "tag", `#${tag}`));
  }
  article.append(tags);
  for (const paragraph of note.body.split(/\n\s*\n/).filter(Boolean)) {
    article.append(createElement("p", undefined, paragraph.replace(/^#+\s*/, "")));
  }
  return article;
}

function createPublicArchive(): HTMLElement {
  const section = createElement("section", "content-section archive-section");
  section.id = "public-notes";
  section.tabIndex = -1;
  section.append(
    createSectionHeading(
      "APPROVED PUBLIC RECORDS",
      "공개된 기록",
      "승인 증적을 가진 공개 콘텐츠만 표시됩니다. 아직 자라지 않은 생각을 채우기 위해 가짜 기록을 만들지 않습니다.",
    ),
  );

  if (publicContent.notes.length === 0) {
    const empty = createElement("div", "seed-state");
    const signal = createElement("div", "seed-signal");
    signal.append(createElement("span", "seed-count", "0"), createElement("span", undefined, "approved records"));
    const copy = createElement("div", "seed-copy");
    copy.append(
      createElement("p", "eyebrow", "SEED STATE"),
      createElement("h3", undefined, "첫 씨앗은 아직 공개되지 않았습니다."),
      createElement(
        "p",
        undefined,
        "기록이 비어 있는 것은 실패가 아니라 약속입니다. 검토와 승인이 끝난 콘텐츠만 이 정원에 나타납니다.",
      ),
      createRouteLink("/lab", "Lab의 진행 중 실험 보기", "text-link"),
    );
    empty.append(signal, copy);
    section.append(empty);
    return section;
  }

  const tags = Array.from(new Set(publicContent.notes.flatMap((note) => note.tags))).sort();
  const filters = createElement("div", "archive-filters");
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "기록 태그 필터");
  const results = createElement("div", "note-list");
  results.setAttribute("aria-live", "polite");
  let activeTag = "all";

  const renderResults = (): void => {
    const visibleNotes =
      activeTag === "all"
        ? publicContent.notes
        : publicContent.notes.filter((note) => note.tags.includes(activeTag));
    results.replaceChildren(...visibleNotes.map(createNoteCard));
    filters.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.tag === activeTag));
    });
  };

  for (const tag of ["all", ...tags]) {
    const label = tag === "all" ? "전체" : `#${tag}`;
    const button = createElement("button", "filter-button", label);
    button.type = "button";
    button.dataset.tag = tag;
    button.addEventListener("click", () => {
      activeTag = tag;
      renderResults();
    });
    filters.append(button);
  }
  section.append(filters, results);
  renderResults();
  return section;
}

function renderGarden(): HTMLElement {
  const page = createElement("div", "page page--garden");
  page.append(
    createHero({
      routeName: "garden",
      kicker: "CORCOIDUM GARDEN",
      title: "돌봄으로 자라는\n지식의 정원",
      description:
        "완성된 정답보다 사람의 검토를 거친 생각이 자라는 곳입니다. 기록은 속도가 아니라 책임으로 공개됩니다.",
      image: "/assets/constellation-garden.jpg",
      imageAlt: "별자리와 뿌리의 빛으로 연결된 한 그루의 새싹과 지식의 정원",
      actions: [
        { label: "공개 기록 보기", href: "#public-notes", style: "primary" },
        { label: "Lab으로 이어가기", href: "/lab", style: "secondary" },
      ],
      note: "Garden에는 approved 또는 published 상태의 비식별 콘텐츠만 나타납니다.",
    }),
    createLifecycle(),
    createPublicArchive(),
  );
  return page;
}

function renderLab(): HTMLElement {
  const page = createElement("div", "page page--lab");
  page.append(
    createHero({
      routeName: "lab",
      kicker: "CORCOIDUM LAB",
      title: "작게 만들고,\n정직하게 검증하며\n계속 배운다.",
      description:
        "완벽해진 뒤 시작하지 않습니다. 합성 데이터와 작은 가설로 실험하고, 실패와 변경의 이유까지 다음 배움으로 남깁니다.",
      image: "/assets/constellation-lab.jpg",
      imageAlt: "실험 플라스크를 중심으로 코드, 가설, 배움의 별자리가 연결된 연구 지도",
      actions: [
        { label: "현재 실험 보기", href: "#experiments", style: "primary" },
        { label: "Projects 보기", href: "/projects", style: "secondary" },
      ],
      note: "실제 환자·직원 데이터 없이, 합성 예시와 공개 승인 데이터만 사용합니다.",
    }),
  );

  const experiments = createElement("section", "content-section experiments-section");
  experiments.id = "experiments";
  experiments.tabIndex = -1;
  experiments.append(
    createSectionHeading(
      "LEARNING IN PUBLIC, SAFELY",
      "지금 검증하는 것",
      "각 실험은 기능 목록보다 질문, 검증 방법, 배운 점을 중심으로 기록합니다.",
    ),
  );
  const ledger = createElement("div", "experiment-ledger");
  for (const experiment of [
    {
      phase: "PHASE 3–4",
      status: "VALIDATED",
      title: "Publishing Gate",
      question: "승인되지 않은 기록이 공개 빌드로 넘어가지 않게 할 수 있는가?",
      result: "metadata·민감 패턴·review 증적을 검사하고 승인된 index만 정적 사이트에 전달합니다.",
    },
    {
      phase: "PHASE 6",
      status: "VERIFIED",
      title: "Automation & Discord",
      question: "배포와 운영 상태를 민감 정보 없이 전달할 수 있는가?",
      result: "비식별 상태 보고와 선택적 Discord 알림을 실제 workflow에서 검증했습니다.",
    },
    {
      phase: "PHASE 7",
      status: "MVP COMPLETE",
      title: "Public Wiki Retrieval",
      question: "승인된 공개 지식만 검색하고 출처를 함께 보여 줄 수 있는가?",
      result: "외부 LLM 호출 없이 정적 public index를 검색하는 retrieval-only MVP를 구현했습니다.",
    },
    {
      phase: "NEXT",
      status: "DECISION PENDING",
      title: "Grounded Answer Layer",
      question: "어떤 provider와 비용·외부 전송 경계가 이 세계관에 맞는가?",
      result: "provider와 승인 흐름이 결정되기 전에는 답변 생성 계층을 성급히 연결하지 않습니다.",
    },
  ]) {
    const row = createElement("article", "experiment-row");
    const meta = createElement("div", "experiment-meta");
    meta.append(
      createElement("span", "experiment-phase", experiment.phase),
      createElement("span", "experiment-status", experiment.status),
    );
    const copy = createElement("div", "experiment-copy");
    copy.append(
      createElement("h3", undefined, experiment.title),
      createElement("p", "experiment-question", experiment.question),
      createElement("p", "experiment-result", experiment.result),
    );
    row.append(meta, copy);
    ledger.append(row);
  }
  experiments.append(ledger);

  const principles = createElement("section", "content-section lab-principles");
  principles.append(
    createSectionHeading(
      "THE LAB DISCIPLINE",
      "실험을 대하는 세 가지 태도",
      "작은 기술일수록 왜 만들었고 무엇을 확인했는지 분명하게 남깁니다.",
    ),
  );
  const principleList = createElement("div", "principle-list");
  for (const [index, title, body] of [
    ["01", "Synthetic first", "민감한 현실 데이터를 가져오기 전에 합성 예시로 경계를 검증합니다."],
    ["02", "Evidence over confidence", "느낌보다 테스트, 변경 이력, 출처가 판단을 뒷받침하게 합니다."],
    ["03", "Human approval", "자동화가 제안할 수는 있어도 공개와 중요한 결정은 사람이 책임집니다."],
  ]) {
    const item = createElement("article", "principle-item");
    item.append(createElement("span", "step-index", index), createElement("h3", undefined, title), createElement("p", undefined, body));
    principleList.append(item);
  }
  principles.append(principleList);
  page.append(experiments, principles);
  return page;
}

function renderProjects(): HTMLElement {
  const page = createElement("div", "page page--projects");
  page.append(
    createHero({
      routeName: "projects",
      kicker: "CORCOIDUM PROJECTS",
      title: "사람을 위한\n시스템을 증거와 함께\n세상에 연결한다.",
      description:
        "기술 자체보다 누구의 어떤 부담을 줄였는지, 어떤 안전 경계를 지켰는지, 무엇으로 검증했는지를 보여 줍니다.",
      image: "/assets/constellation-projects.jpg",
      imageAlt: "나침반과 완료된 이정표 별들이 미래의 산맥으로 이어지는 프로젝트 로드맵",
      actions: [
        { label: "대표 프로젝트 보기", href: "#case-study", style: "primary" },
        { label: "Phase 여정 보기", href: "#roadmap", style: "secondary" },
      ],
      note: "공개 가능한 코드·문서·검증 결과만 포트폴리오 증거로 사용합니다.",
    }),
  );

  const caseStudy = createElement("section", "content-section case-study");
  caseStudy.id = "case-study";
  caseStudy.tabIndex = -1;
  caseStudy.append(
    createSectionHeading(
      "FEATURED CASE STUDY",
      "CORCOIDUM OS",
      "현장의 경험과 다시 시작한 배움을, 안전한 지식·작은 자동화·공개 가능한 소프트웨어로 연결하는 1인용 운영체제입니다.",
    ),
  );
  const story = createElement("div", "case-story");
  for (const [label, title, body] of [
    ["THE FRICTION", "복잡한 도구와 흩어진 맥락", "지식, 개발, 자동화, 공개가 서로 다른 곳에 흩어지면 사람은 연결보다 도구 관리에 더 많은 에너지를 씁니다."],
    ["THE SYSTEM", "관찰에서 공개까지 하나의 흐름", "Vault 경계, metadata, review gate, 정적 UI, Discord 운영 보고, retrieval-only 검색을 단계적으로 연결했습니다."],
    ["THE HUMAN OUTCOME", "안전하게 다시 쓰이는 경험", "민감한 현장 정보는 로컬에 남기고, 검토된 통찰과 구현 증거만 재사용할 수 있는 구조를 만들었습니다."],
  ]) {
    const item = createElement("article", "case-story-item");
    item.append(
      createElement("p", "eyebrow", label),
      createElement("h3", undefined, title),
      createElement("p", undefined, body),
    );
    story.append(item);
  }
  const evidence = createElement("div", "evidence-links");
  evidence.append(
    createExternalLink("https://github.com/corcoidum/ccdos", "GitHub 저장소", "action-link action-link--primary"),
    createExternalLink(
      "https://github.com/corcoidum/ccdos/tree/main/docs/architecture",
      "Architecture 문서",
      "action-link action-link--secondary",
    ),
  );
  caseStudy.append(story, evidence);

  const roadmap = createElement("section", "content-section roadmap-section");
  roadmap.id = "roadmap";
  roadmap.tabIndex = -1;
  roadmap.append(
    createSectionHeading(
      "BUILDING IN PHASES",
      "작게 세우고, 검증하며 확장한 여정",
      "완료한 단계와 아직 결정하지 않은 다음 단계를 같은 언어로 투명하게 보여 줍니다.",
    ),
  );
  const timeline = createElement("ol", "phase-timeline");
  for (const phase of [
    ["0", "Architecture Charter", "목적·책임·보안 경계와 중단 조건 정의", "PASSED"],
    ["1", "Safe Knowledge Foundation", "Vault·metadata·민감 패턴 검증 기반", "PASSED"],
    ["2", "Public Review Foundation", "사람의 review checklist와 승인 증적", "PASSED"],
    ["3–4", "CI Gate & Publishing", "승인된 콘텐츠만 index와 build로 전달", "VALIDATED"],
    ["5", "Public OS UI", "OS·Garden·Lab·Projects 공개 화면", "LIVE"],
    ["6", "Automation & Discord", "비식별 상태 보고와 선택적 webhook", "VERIFIED"],
    ["7", "Retrieval-only Public Wiki", "외부 LLM 없이 승인된 출처 검색", "MVP COMPLETE"],
    ["NEXT", "Grounded Answer Layer", "provider·비용·외부 전송 경계 결정 후 진행", "DECISION PENDING"],
  ]) {
    const item = createElement("li", "phase-item");
    item.append(
      createElement("span", "phase-number", `PHASE ${phase[0]}`),
      createElement("h3", undefined, phase[1]),
      createElement("p", undefined, phase[2]),
      createElement("span", "phase-status", phase[3]),
    );
    timeline.append(item);
  }
  roadmap.append(timeline);
  page.append(caseStudy, roadmap);
  return page;
}

function pageFor(route: Route): HTMLElement {
  const pages: Record<Route, () => HTMLElement> = {
    "/os": renderOs,
    "/garden": renderGarden,
    "/lab": renderLab,
    "/projects": renderProjects,
  };
  return pages[route]();
}

function createHeader(route: Route): HTMLElement {
  const header = createElement("header", "site-header");
  const inner = createElement("div", "header-inner");
  const brand = createRouteLink("/os", "CORCOIDUM OS", "brand");
  brand.setAttribute("aria-label", "CORCOIDUM OS 홈");

  const nav = createElement("nav", "site-nav");
  nav.setAttribute("aria-label", "주요 메뉴");
  for (const item of routeDefinitions) {
    const link = createRouteLink(item.path, item.label, "nav-link");
    if (item.path === route) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
    nav.append(link);
  }
  inner.append(brand, nav);
  header.append(inner);
  return header;
}

function createFooter(): HTMLElement {
  const footer = createElement("footer", "site-footer");
  const inner = createElement("div", "footer-inner");
  const identity = createElement("div", "footer-identity");
  identity.append(
    createElement("strong", undefined, "CORCOIDUM"),
    createElement("p", undefined, "Where codes and hearts coexist. The future of Tech is human."),
  );
  const links = createElement("div", "footer-links");
  links.append(
    createRouteLink("/garden", "Garden", "footer-link"),
    createRouteLink("/lab", "Lab", "footer-link"),
    createRouteLink("/projects", "Projects", "footer-link"),
    createExternalLink("https://github.com/corcoidum/ccdos", "GitHub", "footer-link"),
    createExternalLink("https://www.threads.com/@openkiki.os", "Threads", "footer-link"),
  );
  inner.append(identity, links);
  footer.append(inner, createElement("p", "footer-note", "© 2026 CORCOIDUM OS · Built with care, reviewed by humans."));
  return footer;
}

const REVEAL_SELECTORS = [
  ".hero-copy",
  ".section-heading",
  ".journey-step",
  ".value-item",
  ".portal-row",
  ".lifecycle-list li",
  ".experiment-row",
  ".principle-item",
  ".case-story-item",
  ".phase-item",
  ".note-entry",
  ".seed-state",
  ".evidence-links",
  ".dur-note",
].join(", ");

let revealCleanup: (() => void) | null = null;

function setupReveals(root: HTMLElement): void {
  revealCleanup?.();
  revealCleanup = null;
  if (prefersReducedMotion()) {
    return;
  }

  const scrollDriven = supportsScrollDrivenAnimations();
  const pending = new Set<HTMLElement>();
  const groupCounts = new Map<HTMLElement | null, number>();
  root.querySelectorAll<HTMLElement>(REVEAL_SELECTORS).forEach((element) => {
    if (scrollDriven && element.classList.contains("phase-item")) {
      // The CSS scroll-driven roadmap animation owns this element's entrance.
      return;
    }
    const parent = element.parentElement;
    const index = groupCounts.get(parent) ?? 0;
    groupCounts.set(parent, index + 1);
    element.classList.add("reveal");
    element.style.setProperty("--reveal-delay", `${Math.min(index * 70, 350)}ms`);
    pending.add(element);
  });

  const revealOnScreen = (): void => {
    for (const element of pending) {
      const rect = element.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
        element.classList.add("is-visible");
        pending.delete(element);
      }
    }
    if (pending.size === 0) {
      revealCleanup?.();
      revealCleanup = null;
    }
  };

  // Scroll reacts immediately; the timer chain guarantees reveal even where
  // scroll events are throttled, so content can never stay hidden.
  let pollTimer = 0;
  const poll = (): void => {
    revealOnScreen();
    if (pending.size > 0) {
      pollTimer = window.setTimeout(poll, 400);
    }
  };
  window.addEventListener("scroll", revealOnScreen, { passive: true });
  window.addEventListener("resize", revealOnScreen);
  revealCleanup = () => {
    window.removeEventListener("scroll", revealOnScreen);
    window.removeEventListener("resize", revealOnScreen);
    window.clearTimeout(pollTimer);
  };
  pollTimer = window.setTimeout(poll, 40);
}

function render({ announce = false, restoreHistory = false }: RenderOptions = {}): void {
  const route = currentRoute();
  if (window.location.pathname !== route) {
    window.history.replaceState({}, "", route);
  }
  const routeDefinition = routeDefinitions.find(({ path }) => path === route);
  document.title = `${routeDefinition?.title ?? "세계관과 시스템"} | CORCOIDUM OS`;

  const skipLink = createElement("a", "skip-link", "본문으로 건너뛰기");
  skipLink.href = "#main-content";
  const main = createElement("main", "site-main");
  main.id = "main-content";
  main.append(pageFor(route));
  appRoot.replaceChildren(skipLink, createHeader(route), main, createFooter());
  setupReveals(main);

  if (announce) {
    window.requestAnimationFrame(() => {
      const hashTarget = window.location.hash
        ? document.getElementById(window.location.hash.slice(1))
        : null;
      if (hashTarget) {
        hashTarget.scrollIntoView({ block: "start", behavior: "auto" });
        hashTarget.focus({ preventScroll: true });
        return;
      }
      if (!restoreHistory) {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
      document.querySelector<HTMLElement>("#page-title")?.focus({ preventScroll: true });
    });
  }
}

window.addEventListener("popstate", () =>
  renderWithTransition({ announce: true, restoreHistory: true }),
);
render();
