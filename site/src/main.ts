import content from "../../content/public/index.json";
import graph from "../../content/public/graph.json";
import {
  connectionsForNote,
  createKnowledgeMap,
  relationLabel,
  type PublicGraph,
} from "./graph-view";
import {
  phaseDefinitions,
  phaseDefinitionsById,
  type PhaseDefinition,
  type PhaseEvidence,
} from "./phase-details";
import {
  publicRecordNumbers,
  type PublicContent,
  type PublicNote,
  searchPublicNotes,
  tokenize,
} from "./search";
import "./style.css";

type PrimaryRoute = "/os" | "/garden" | "/lab" | "/projects" | "/graph";
type ValueRoute = "/hope" | "/trust" | "/mercy" | "/love";
type Route = PrimaryRoute | ValueRoute;
type ValueTag = "hope" | "trust" | "mercy" | "love";

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

type ValueSpaceConfig = {
  path: ValueRoute;
  tag: ValueTag;
  name: string;
  meaning: string;
  description: string;
  image: string;
  imageAlt: string;
};

type AnswerApiResponse = {
  mode: "generated" | "retrieval";
  reason?: string;
  answer: string;
  sources: Array<{ id: string; title: string }>;
  model?: string;
};

type RenderOptions = {
  announce?: boolean;
  restoreHistory?: boolean;
};

type NoteModalCloseOptions = {
  restoreFocus?: boolean;
  syncHistory?: boolean;
};

type NoteModalHistoryMode = "push" | "replace" | "none";

type PhaseModalCloseOptions = {
  restoreFocus?: boolean;
  syncHistory?: boolean;
};

type PhaseModalHistoryMode = "push" | "none";

type NavigationDirection = "backward" | "forward" | "none";

type ViewTransition = {
  finished: Promise<void>;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransition;
};

const publicContent = content as PublicContent;
const publicGraph = graph as PublicGraph;
const publicNotesById = new Map(publicContent.notes.map((note) => [note.id, note]));
const NOTE_MODAL_HISTORY_KEY = "corcoidumNoteModal";
const PHASE_MODAL_HISTORY_KEY = "corcoidumPhaseModal";
const primaryRouteDefinitions: RouteDefinition[] = [
  { path: "/os", label: "OS", title: "세계관과 시스템" },
  { path: "/garden", label: "Garden", title: "검토된 기록" },
  { path: "/lab", label: "Lab", title: "작은 실험" },
  { path: "/projects", label: "Projects", title: "결과와 증거" },
  { path: "/graph", label: "Map", title: "읽기 전용 지식 연결 지도" },
];
const valueSpaces: readonly ValueSpaceConfig[] = [
  {
    path: "/hope",
    tag: "hope",
    name: "H.O.P.E",
    meaning: "성장 · 재시작 · 학습",
    description:
      "배움의 공백과 실패를 끝으로 보지 않습니다. 다시 시작한 학습과 새 기술, 다시 시도한 기록을 다음 성장의 발판으로 남깁니다.",
    image: "/assets/value-hope.webp",
    imageAlt: "갈라진 땅에서 책장 계단이 새벽 별을 향해 다시 오르는 H.O.P.E 별자리",
  },
  {
    path: "/trust",
    tag: "trust",
    name: "T.R.U.S.T",
    meaning: "명확한 사고 · 시스템 · 기술",
    description:
      "설명할 수 있고 다시 검증할 수 있는 시스템을 만듭니다. 구축과 검증, 디버깅의 근거를 남겨 기술 위에 신뢰를 쌓습니다.",
    image: "/assets/value-trust.webp",
    imageAlt: "빛이 투명한 프리즘과 검증 관문을 통과하는 정밀한 T.R.U.S.T 천체 장치",
  },
  {
    path: "/mercy",
    tag: "mercy",
    name: "M.E.R.C.Y",
    meaning: "사람의 부담을 줄이는 기술",
    description:
      "현장의 마찰을 먼저 보고 반복 업무와 불필요한 부담을 줄이는 자동화를 만듭니다. 기능 수보다 사람이 되찾은 여유를 성과로 봅니다.",
    image: "/assets/value-mercy.webp",
    imageAlt: "도르래가 무거운 돌을 들어 올리고 열린 손에는 깃털이 놓인 M.E.R.C.Y 별자리",
  },
  {
    path: "/love",
    tag: "love",
    name: "L.O.V.E",
    meaning: "가족 · 일상 · 지속 가능성",
    description:
      "가족과 일상, 건강을 희생하지 않아도 이어 갈 수 있는 기술을 선택합니다. 일과 삶을 함께 지키는 지속 가능한 리듬을 기록합니다.",
    image: "/assets/value-love.webp",
    imageAlt: "집과 가족의 식탁을 달과 계절의 순환이 감싸는 L.O.V.E 별자리",
  },
];
const valueRouteDefinitions: RouteDefinition[] = valueSpaces.map(({ path, name, meaning }) => ({
  path,
  label: name,
  title: `${name} · ${meaning}`,
}));
const routeDefinitions: RouteDefinition[] = [
  ...primaryRouteDefinitions,
  ...valueRouteDefinitions,
];
const routes = routeDefinitions.map(({ path }) => path);
// Knowledge Map은 내부 node와 관계를 직접 조작하므로 swipe 순환에서 제외한다.
const gestureRoutes: Route[] = ["/os", "/garden", "/lab", "/projects"];
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

function hasNoteQuery(): boolean {
  return new URLSearchParams(window.location.search).has("note");
}

function noteIdFromLocation(): string | null {
  return new URLSearchParams(window.location.search).get("note");
}

function currentHistoryTracksNote(): boolean {
  const state = window.history.state;
  return Boolean(
    state &&
      typeof state === "object" &&
      !Array.isArray(state) &&
      typeof state[NOTE_MODAL_HISTORY_KEY] === "string",
  );
}

function noteHistoryState(noteId: string | null, trackNote: boolean): Record<string, unknown> {
  const currentState = window.history.state;
  const state =
    currentState && typeof currentState === "object" && !Array.isArray(currentState)
      ? { ...currentState }
      : {};
  if (noteId === null || !trackNote) {
    delete state[NOTE_MODAL_HISTORY_KEY];
  } else {
    state[NOTE_MODAL_HISTORY_KEY] = noteId;
    delete state[PHASE_MODAL_HISTORY_KEY];
  }
  return state;
}

function updateNoteQuery(noteId: string | null, mode: "push" | "replace"): void {
  const url = new URL(window.location.href);
  if (noteId === null) {
    url.searchParams.delete("note");
  } else {
    url.searchParams.set("note", noteId);
    url.searchParams.delete("phase");
  }
  const relativeUrl = `${url.pathname}${url.search}${url.hash}`;
  const state = noteHistoryState(noteId, mode === "push" || currentHistoryTracksNote());
  if (mode === "push") {
    window.history.pushState(state, "", relativeUrl);
  } else {
    window.history.replaceState(state, "", relativeUrl);
  }
}

function currentHistoryOwnsNote(noteId: string): boolean {
  const state = window.history.state;
  return Boolean(
    state &&
      typeof state === "object" &&
      !Array.isArray(state) &&
      state[NOTE_MODAL_HISTORY_KEY] === noteId,
  );
}

function hasPhaseQuery(): boolean {
  return new URLSearchParams(window.location.search).has("phase");
}

function phaseIdFromLocation(): string | null {
  return new URLSearchParams(window.location.search).get("phase");
}

function currentHistoryTracksPhase(): boolean {
  const state = window.history.state;
  return Boolean(
    state &&
      typeof state === "object" &&
      !Array.isArray(state) &&
      typeof state[PHASE_MODAL_HISTORY_KEY] === "string",
  );
}

function phaseHistoryState(phaseId: string | null, trackPhase: boolean): Record<string, unknown> {
  const currentState = window.history.state;
  const state =
    currentState && typeof currentState === "object" && !Array.isArray(currentState)
      ? { ...currentState }
      : {};
  if (phaseId === null || !trackPhase) {
    delete state[PHASE_MODAL_HISTORY_KEY];
  } else {
    state[PHASE_MODAL_HISTORY_KEY] = phaseId;
    delete state[NOTE_MODAL_HISTORY_KEY];
  }
  return state;
}

function updatePhaseQuery(phaseId: string | null, mode: "push" | "replace"): void {
  const url = new URL(window.location.href);
  if (phaseId === null) {
    url.searchParams.delete("phase");
  } else {
    url.searchParams.set("phase", phaseId);
    url.searchParams.delete("note");
    url.hash = "roadmap";
  }
  const relativeUrl = `${url.pathname}${url.search}${url.hash}`;
  const state = phaseHistoryState(phaseId, mode === "push" || currentHistoryTracksPhase());
  if (mode === "push") {
    window.history.pushState(state, "", relativeUrl);
  } else {
    window.history.replaceState(state, "", relativeUrl);
  }
}

function currentHistoryOwnsPhase(phaseId: string): boolean {
  const state = window.history.state;
  return Boolean(
    state &&
      typeof state === "object" &&
      !Array.isArray(state) &&
      state[PHASE_MODAL_HISTORY_KEY] === phaseId,
  );
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

function routeDirection(from: Route, to: Route): NavigationDirection {
  const fromIndex = gestureRoutes.indexOf(from);
  const toIndex = gestureRoutes.indexOf(to);
  if (fromIndex < 0 || toIndex < 0) {
    return "none";
  }
  const difference = toIndex - fromIndex;
  return difference > 0 ? "forward" : difference < 0 ? "backward" : "none";
}

function renderWithTransition(options: RenderOptions, direction: NavigationDirection = "none"): void {
  const transitionDocument = document as ViewTransitionDocument;
  if (!prefersReducedMotion() && typeof transitionDocument.startViewTransition === "function") {
    document.documentElement.dataset.navigationDirection = direction;
    const transition = transitionDocument.startViewTransition(() => render(options));
    void transition.finished.finally(() => {
      delete document.documentElement.dataset.navigationDirection;
    });
    return;
  }
  render(options);
}

function navigate(route: Route, direction?: NavigationDirection): void {
  const from = currentRoute();
  if (window.location.pathname === route) {
    closeActiveNoteModal?.({ syncHistory: false });
    closeActivePhaseModal?.({ syncHistory: false });
    if (window.location.search || window.location.hash) {
      window.history.replaceState({}, "", route);
    }
    window.scrollTo({ top: 0, behavior: "auto" });
    return;
  }
  window.history.pushState({}, "", route);
  renderWithTransition({ announce: true }, direction ?? routeDirection(from, route));
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
  } else if (action.href.startsWith("#")) {
    link.addEventListener("click", (event) => {
      if (!isPlainLeftClick(event)) {
        return;
      }
      const target = document.querySelector<HTMLElement>(action.href);
      if (!target) {
        return;
      }
      event.preventDefault();
      window.history.pushState({}, "", `${window.location.pathname}${action.href}`);
      target.scrollIntoView({
        block: "start",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
      target.focus({ preventScroll: true });
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
  const inner = createElement("div", "hero-inner");
  const copy = createElement("div", "hero-copy");
  copy.append(createElement("p", "eyebrow", config.kicker));
  if (config.showCredo) {
    copy.append(
      createElement(
        "p",
        "hero-credo",
        "Where hearts and codes coexist, the future of technology is human.",
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
  // 원본 별자리는 자르지 않고 보여 주며, 같은 이미지의 ambient backdrop만 패널의 남는 영역을 채운다.
  visual.style.setProperty("--hero-image", `url("${config.image}")`);
  const frame = createElement("div", "hero-frame");
  const image = createElement("img");
  image.src = config.image;
  image.alt = config.imageAlt;
  image.width = 1536;
  image.height = 1024;
  image.decoding = "async";
  image.loading = "eager";
  image.setAttribute("fetchpriority", "high");
  frame.append(image);
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
    frame.append(constellationNav);
  }
  visual.append(frame);

  inner.append(copy, visual);
  hero.append(inner);
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
  values.id = "values";
  values.tabIndex = -1;
  values.append(
    createSectionHeading(
      "FOUR HUMAN PROMISES",
      "내가 지키려는 네 가지 약속",
      "기술의 속도보다 어떤 삶을 지키려는지 먼저 묻는 CORCOIDUM의 기준입니다.",
    ),
  );
  const valueList = createElement("div", "value-list");
  for (const value of valueSpaces) {
    const item = createRouteLink(value.path, "", "value-item value-item-link");
    item.dataset.value = value.tag;
    item.setAttribute("aria-label", `${value.name} 가치 공간: ${value.meaning}`);
    item.append(
      createElement("p", "value-name", value.name),
      createElement("h3", undefined, value.meaning),
      createElement("p", "value-description", value.description),
      createElement("span", "value-action", "가치 공간 보기"),
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

function renderValueSpace(value: ValueSpaceConfig): HTMLElement {
  const notes = publicContent.notes.filter((note) => note.tags.includes(value.tag));
  const page = createElement("div", `page page--value page--${value.tag}`);
  page.append(
    createHero({
      routeName: value.tag,
      kicker: `살아 있는 가치 · ${value.name}`,
      title: `${value.name}\n${value.meaning}`,
      description: value.description,
      image: value.image,
      imageAlt: value.imageAlt,
      actions: [
        { label: `${value.name} 기록 보기`, href: "#value-records", style: "primary" },
        { label: "Garden 전체 기록", href: "/garden", style: "secondary" },
      ],
      note: "가치는 선언으로 끝나지 않습니다. 승인된 공개 기록이 쌓이는 동안 이 공간도 계속 자랍니다.",
    }),
  );

  const records = createElement("section", "content-section value-records-section");
  records.id = "value-records";
  records.tabIndex = -1;
  records.append(
    createSectionHeading(
      `#${value.tag} · 승인된 공개 기록`,
      `${value.meaning}에서 자란 기록`,
      `${value.name}의 의미를 실제 배움과 선택으로 남긴 공개 기록만 모았습니다.`,
    ),
  );

  const growthState = createElement("aside", "value-growth-state");
  const growthCopy = createElement("div", "value-growth-copy");
  growthCopy.append(
    createElement("p", "eyebrow", "기록 상태"),
    createElement("strong", "value-growth-label", "자라는 중"),
  );
  growthState.append(
    growthCopy,
    createElement(
      "p",
      undefined,
      `현재 ${notes.length}편의 승인된 기록이 연결되어 있습니다. 기록이 더 쌓인 뒤에도 사람의 검토를 거쳐 다음 상태를 결정합니다.`,
    ),
  );
  records.append(growthState);

  if (notes.length > 0) {
    const noteList = createElement("div", "note-list value-note-list");
    noteList.id = `value-note-list-${value.tag}`;
    noteList.append(
      ...notes.map((note) =>
        createNoteCard(
          note,
          publicContent.notes.length - publicContent.notes.findIndex(({ id }) => id === note.id),
        ),
      ),
    );
    records.append(noteList);
  } else {
    const empty = createElement("div", "value-empty-state");
    empty.append(
      createElement("p", "eyebrow", "첫 기록을 기다립니다"),
      createElement("h3", undefined, "비어 있기보다, 자라는 중입니다."),
      createElement(
        "p",
        undefined,
        "검토와 승인을 마친 기록만 이곳에 놓입니다. 아직 없는 내용을 채우기 위해 약속을 낮추지 않습니다.",
      ),
    );
    records.append(empty);
  }

  page.append(records);
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

function noteParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/^#+\s*/, "").trim())
    .filter(Boolean);
}

function appendNoteBody(container: HTMLElement, note: PublicNote): void {
  for (const paragraph of noteParagraphs(note.body)) {
    container.append(createElement("p", undefined, paragraph));
  }
}

function noteExcerpt(note: PublicNote, limit = 180): string {
  const first = noteParagraphs(note.body)[0] ?? "";
  const normalized = first.split(/\s+/).join(" ");
  return normalized.length > limit ? `${normalized.slice(0, limit).trimEnd()}…` : normalized;
}

function createNoteConnectionsSection(
  note: PublicNote,
  selectNote: (target: PublicNote) => void,
): HTMLElement | null {
  const connections = connectionsForNote(publicGraph, publicNotesById, note.id);
  if (connections.length === 0) {
    return null;
  }

  const section = createElement("section", "note-relations");
  const headingId = `note-relations-title-${note.id}`;
  section.setAttribute("aria-labelledby", headingId);
  const eyebrow = createElement("p", "eyebrow note-relations-eyebrow", "지식의 연결");
  const heading = createElement("h3", "note-relations-title", "이어지는 기록");
  heading.id = headingId;
  const list = createElement("ul", "note-relations-list");

  for (const connection of connections) {
    const item = createElement("li", "note-relation-item");
    const button = createElement("button", "note-relation-button");
    button.type = "button";
    button.dataset.noteId = connection.note.id;
    button.append(
      createElement("span", "note-relation-title", connection.note.title),
      createElement(
        "span",
        "note-relation-type",
        relationLabel(connection.type, connection.direction),
      ),
    );
    button.addEventListener("click", () => selectNote(connection.note));
    item.append(button);
    list.append(item);
  }

  section.append(eyebrow, heading, list);
  return section;
}

let activeNoteModalId: string | null = null;
let noteHistoryBackPending = false;
let closeActiveNoteModal: ((options?: NoteModalCloseOptions) => void) | null = null;
let showActiveNoteModal: ((note: PublicNote, historyMode: NoteModalHistoryMode) => void) | null = null;
let activeNoteModalReturnFocus: HTMLElement | null = null;

// Lab 검색 결과와 Garden 카드가 함께 쓰는 전문 읽기 모달. 데이터는 이미 클라이언트에 있어 추가 요청이 없다.
function openNoteModal(
  note: PublicNote,
  trigger: HTMLElement | null,
  historyMode: NoteModalHistoryMode = "push",
): void {
  const previousFocus =
    activeNoteModalReturnFocus ?? trigger ?? (document.activeElement as HTMLElement | null);
  closeActivePhaseModal?.({ restoreFocus: false, syncHistory: false });
  closeActiveNoteModal?.({ restoreFocus: false, syncHistory: false });

  const overlay = createElement("div", "note-modal-overlay");
  overlay.dataset.swipeIgnore = "";
  const dialog = createElement("div", "note-modal");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");

  const closeButton = createElement("button", "note-modal-close", "✕");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "닫기");

  const scroll = createElement("div", "note-modal-scroll");
  dialog.append(closeButton, scroll);
  overlay.append(dialog);
  document.body.append(overlay);

  const scrollLock = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  appRoot.setAttribute("aria-hidden", "true");
  appRoot.inert = true;

  const showNote = (
    nextNote: PublicNote,
    nextHistoryMode: NoteModalHistoryMode,
    focusHeading = false,
  ): void => {
    if (nextHistoryMode !== "none") {
      updateNoteQuery(nextNote.id, nextHistoryMode);
    }
    activeNoteModalId = nextNote.id;
    const titleId = `note-modal-title-${nextNote.id}`;
    dialog.setAttribute("aria-labelledby", titleId);

    const meta = createElement("p", "note-meta");
    const displayDate = nextNote.published_at ?? nextNote.updated;
    const time = createElement("time", undefined, formatDate(displayDate));
    time.dateTime = displayDate;
    meta.append(time, document.createTextNode(` · ${nextNote.state}`));
    const heading = createElement("h2", "note-modal-title", nextNote.title);
    heading.id = titleId;
    const tags = createElement("div", "tag-list");
    for (const tag of nextNote.tags) {
      tags.append(createElement("span", "tag", `#${tag}`));
    }
    const body = createElement("div", "note-modal-body");
    appendNoteBody(body, nextNote);
    const connections = createNoteConnectionsSection(nextNote, (target) =>
      showNote(target, "replace", true),
    );
    scroll.replaceChildren(meta, heading, tags, body);
    if (connections) {
      scroll.append(connections);
    }
    scroll.scrollTop = 0;
    if (focusHeading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  };

  const close = ({ restoreFocus = true, syncHistory = true }: NoteModalCloseOptions = {}): void => {
    if (closeActiveNoteModal !== close) {
      return;
    }
    const closingNoteId = activeNoteModalId;
    closeActiveNoteModal = null;
    showActiveNoteModal = null;
    activeNoteModalId = null;
    activeNoteModalReturnFocus = null;
    document.removeEventListener("keydown", onKeydown, true);
    overlay.remove();
    document.body.style.overflow = scrollLock;
    appRoot.removeAttribute("aria-hidden");
    appRoot.inert = false;
    if (restoreFocus) {
      previousFocus?.focus?.({ preventScroll: true });
    }
    if (syncHistory && closingNoteId && noteIdFromLocation() === closingNoteId) {
      if (currentHistoryOwnsNote(closingNoteId)) {
        noteHistoryBackPending = true;
        window.history.back();
      } else {
        updateNoteQuery(null, "replace");
      }
    }
  };

  const focusable = (): HTMLElement[] =>
    Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])',
      ),
    );

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const items = focusable();
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  closeButton.addEventListener("click", () => close());
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close();
    }
  });
  document.addEventListener("keydown", onKeydown, true);
  activeNoteModalReturnFocus = previousFocus;
  showActiveNoteModal = (nextNote, nextHistoryMode) => showNote(nextNote, nextHistoryMode, false);
  closeActiveNoteModal = close;
  showNote(note, historyMode);
  window.requestAnimationFrame(() => closeButton.focus({ preventScroll: true }));
}

function syncNoteModalFromLocation(): void {
  if (!hasNoteQuery()) {
    closeActiveNoteModal?.({ syncHistory: false });
    return;
  }
  const noteId = noteIdFromLocation() ?? "";
  const note = publicNotesById.get(noteId);
  if (!note) {
    closeActiveNoteModal?.({ syncHistory: false });
    updateNoteQuery(null, "replace");
    return;
  }
  if (activeNoteModalId === note.id) {
    return;
  }
  if (showActiveNoteModal) {
    showActiveNoteModal(note, "none");
    return;
  }
  const trigger = document.querySelector<HTMLElement>(`[data-note-id="${note.id}"]`);
  openNoteModal(note, trigger, "none");
}

let activePhaseModalId: string | null = null;
let phaseHistoryBackPending = false;
let closeActivePhaseModal: ((options?: PhaseModalCloseOptions) => void) | null = null;
let activePhaseModalReturnFocus: HTMLElement | null = null;

function createPhaseListSection(title: string, items: readonly string[]): HTMLElement {
  const section = createElement("section", "phase-modal-section");
  section.append(createElement("h3", undefined, title));
  const list = createElement("ul", "phase-modal-list");
  for (const item of items) {
    list.append(createElement("li", undefined, item));
  }
  section.append(list);
  return section;
}

function createPhaseEvidenceItem(entry: PhaseEvidence): HTMLLIElement {
  const item = createElement("li", "phase-modal-evidence-item");
  const source = createElement("span", "phase-modal-evidence-source", `출처 · ${entry.sourceLabel}`);
  const title = createElement("h4", "phase-modal-evidence-title", entry.label);
  const summary = createElement("p", "phase-modal-evidence-summary", entry.summary);
  const link = createElement(
    "a",
    "phase-modal-evidence-link",
    entry.sourceLabel === "GitHub" ? "GitHub 원문 보기 →" : `${entry.sourceLabel}에서 보기 →`,
  );
  link.href = entry.href;
  link.setAttribute(
    "aria-label",
    `${entry.label}: ${entry.sourceLabel}에서 현재 탭으로 이동해 확인`,
  );
  item.append(source, title, summary, link);
  return item;
}

// 모든 Phase가 같은 dialog 구조와 keyboard·history 규칙을 공유한다.
function openPhaseModal(
  phase: PhaseDefinition,
  trigger: HTMLElement | null,
  historyMode: PhaseModalHistoryMode = "push",
): void {
  const previousFocus =
    activePhaseModalReturnFocus ?? trigger ?? (document.activeElement as HTMLElement | null);
  closeActiveNoteModal?.({ restoreFocus: false, syncHistory: false });
  closeActivePhaseModal?.({ restoreFocus: false, syncHistory: false });
  if (historyMode === "push") {
    updatePhaseQuery(phase.id, "push");
  }

  const overlay = createElement("div", "note-modal-overlay phase-modal-overlay");
  overlay.dataset.swipeIgnore = "";
  const dialog = createElement("div", "note-modal phase-modal");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  const titleId = `phase-modal-title-${phase.id}`;
  dialog.setAttribute("aria-labelledby", titleId);

  const closeButton = createElement("button", "note-modal-close", "✕");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "닫기");
  const scroll = createElement("div", "note-modal-scroll phase-modal-scroll");

  const meta = createElement("div", "phase-modal-meta");
  meta.append(
    createElement("span", "phase-number", `PHASE ${phase.id}`),
    createElement("span", "phase-status", phase.status),
  );
  const heading = createElement("h2", "note-modal-title phase-modal-title", phase.title);
  heading.id = titleId;
  const summary = createElement("p", "phase-modal-summary", phase.summary);

  const purpose = createElement("section", "phase-modal-section");
  purpose.append(
    createElement("h3", undefined, "목적"),
    createElement("p", undefined, phase.purpose),
  );

  const evidence = createElement("section", "phase-modal-section");
  evidence.append(createElement("h3", undefined, "검증과 증거"));
  const evidenceList = createElement("ul", "phase-modal-evidence-list");
  for (const entry of phase.evidence) {
    evidenceList.append(createPhaseEvidenceItem(entry));
  }
  evidence.append(evidenceList);

  const outcome = createElement("section", "phase-modal-section phase-modal-outcome");
  outcome.append(
    createElement("h3", undefined, "결과"),
    createElement("p", undefined, phase.outcome),
  );

  scroll.append(
    meta,
    heading,
    summary,
    purpose,
    createPhaseListSection("구현", phase.delivered),
    createPhaseListSection("안전 경계", phase.boundaries),
    evidence,
    outcome,
  );
  dialog.append(closeButton, scroll);
  overlay.append(dialog);
  document.body.append(overlay);

  const scrollLock = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  appRoot.setAttribute("aria-hidden", "true");
  appRoot.inert = true;
  activePhaseModalId = phase.id;
  activePhaseModalReturnFocus = previousFocus;

  const close = ({ restoreFocus = true, syncHistory = true }: PhaseModalCloseOptions = {}): void => {
    if (closeActivePhaseModal !== close) {
      return;
    }
    const closingPhaseId = activePhaseModalId;
    closeActivePhaseModal = null;
    activePhaseModalId = null;
    activePhaseModalReturnFocus = null;
    document.removeEventListener("keydown", onKeydown, true);
    overlay.remove();
    document.body.style.overflow = scrollLock;
    appRoot.removeAttribute("aria-hidden");
    appRoot.inert = false;
    if (restoreFocus) {
      previousFocus?.focus?.({ preventScroll: true });
    }
    if (syncHistory && closingPhaseId && phaseIdFromLocation() === closingPhaseId) {
      if (currentHistoryOwnsPhase(closingPhaseId)) {
        phaseHistoryBackPending = true;
        window.history.back();
      } else {
        updatePhaseQuery(null, "replace");
      }
    }
  };

  const focusable = (): HTMLElement[] =>
    Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const items = focusable();
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  closeButton.addEventListener("click", () => close());
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close();
    }
  });
  document.addEventListener("keydown", onKeydown, true);
  closeActivePhaseModal = close;
  window.requestAnimationFrame(() => closeButton.focus({ preventScroll: true }));
}

function syncPhaseModalFromLocation(): void {
  if (currentRoute() !== "/projects" || hasNoteQuery()) {
    closeActivePhaseModal?.({ syncHistory: false });
    if (hasPhaseQuery()) {
      updatePhaseQuery(null, "replace");
    }
    return;
  }
  if (!hasPhaseQuery()) {
    closeActivePhaseModal?.({ syncHistory: false });
    return;
  }
  const phaseId = phaseIdFromLocation() ?? "";
  const phase = phaseDefinitionsById.get(phaseId);
  if (!phase) {
    closeActivePhaseModal?.({ syncHistory: false });
    updatePhaseQuery(null, "replace");
    return;
  }
  if (activePhaseModalId === phase.id) {
    return;
  }
  const trigger = document.querySelector<HTMLElement>(`[data-phase-id="${phase.id}"]`);
  openPhaseModal(phase, trigger, "none");
}

function attachNoteOpener(card: HTMLElement, note: PublicNote): HTMLButtonElement {
  const openButton = createElement("button", "note-open-button", note.title);
  openButton.type = "button";
  openButton.dataset.noteId = note.id;
  openButton.setAttribute("aria-haspopup", "dialog");
  openButton.addEventListener("click", () => openNoteModal(note, openButton));
  // 카드 어디를 눌러도 열리게 하되, 태그·링크 등 다른 인터랙션은 방해하지 않는다.
  card.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("button, a")) {
      return;
    }
    openNoteModal(note, openButton);
  });
  return openButton;
}

function createNoteCard(note: PublicNote, recordNumber: number): HTMLElement {
  const article = createElement("article", "note-entry");
  const meta = createElement("p", "note-meta");
  const displayDate = note.published_at ?? note.updated;
  const time = createElement("time", undefined, formatDate(displayDate));
  time.dateTime = displayDate;
  meta.append(time, document.createTextNode(` · ${note.state}`));
  const title = createElement("h3");
  const openButton = attachNoteOpener(article, note);
  title.append(createElement("span", "note-number", String(recordNumber).padStart(2, "0")), openButton);
  article.append(meta, title);

  const tags = createElement("div", "tag-list");
  for (const tag of note.tags) {
    tags.append(createElement("span", "tag", `#${tag}`));
  }
  article.append(tags, createElement("p", "note-excerpt", noteExcerpt(note)));
  return article;
}

function createPublicArchive(): HTMLElement {
  const initialLimit = 2;
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

  // 기록이 늘어나거나 태그 필터를 걸어도 번호가 바뀌지 않도록, 가장 오래된 기록을 01번으로 고정한다.
  const recordNumbers = publicRecordNumbers(publicContent.notes);
  const tags = Array.from(new Set(publicContent.notes.flatMap((note) => note.tags))).sort();
  const filters = createElement("div", "archive-filters");
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "기록 태그 필터");
  const results = createElement("div", "note-list");
  results.id = "public-note-list";
  results.setAttribute("aria-live", "polite");
  const toggle = createElement("button", "archive-toggle");
  toggle.type = "button";
  toggle.setAttribute("aria-controls", results.id);
  let activeTag = "all";
  let expanded = false;

  const renderResults = (): void => {
    const filteredNotes =
      activeTag === "all"
        ? publicContent.notes
        : publicContent.notes.filter((note) => note.tags.includes(activeTag));
    const visibleNotes = expanded ? filteredNotes : filteredNotes.slice(0, initialLimit);
    results.replaceChildren(
      ...visibleNotes.map((note) => createNoteCard(note, recordNumbers.get(note.id) ?? 0)),
    );
    const remaining = Math.max(filteredNotes.length - initialLimit, 0);
    toggle.hidden = remaining === 0;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "기록 접기" : `기록 ${remaining}개 더 보기`;
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
      expanded = false;
      renderResults();
    });
    filters.append(button);
  }
  toggle.addEventListener("click", () => {
    expanded = !expanded;
    renderResults();
  });
  section.append(filters, results, toggle);
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

function createWikiSearch(): HTMLElement {
  const section = createElement("section", "content-section wiki-search-section");
  section.id = "wiki-search";
  section.tabIndex = -1;
  section.append(
    createSectionHeading(
      "TRY THE LIVE EXPERIMENT",
      "공개 위키 검색, 직접 써보세요",
      "기본 검색은 브라우저 안에서만 실행됩니다. AI 답변 생성을 직접 선택한 경우에만 질문과 관련 승인 공개 출처가 OpenAI로 전송되며, 근거가 없으면 생성하지 않습니다.",
    ),
  );

  const form = createElement("form", "wiki-search-form");
  const input = createElement("input", "wiki-search-input");
  input.type = "search";
  input.placeholder = "예: 403, 자동화, 정원";
  input.maxLength = 200;
  input.setAttribute("aria-label", "공개 기록 검색어");
  const searchButton = createElement("button", "action-link action-link--primary", "근거 검색");
  searchButton.type = "submit";
  const answerButton = createElement("button", "action-link action-link--secondary", "AI 답변 생성");
  answerButton.type = "button";
  form.append(input, searchButton, answerButton);

  const privacyNotice = createElement(
    "p",
    "wiki-ai-notice",
    "AI 답변에는 개인·환자·직원 정보를 입력하지 마세요. 이 기능은 공개 승인 기록의 운영·학습 내용을 요약하며 의료 판단을 대신하지 않습니다.",
  );

  const results = createElement("div", "wiki-search-results");
  results.setAttribute("aria-live", "polite");
  const answerPanel = createElement("section", "wiki-answer-panel");
  answerPanel.setAttribute("aria-live", "polite");

  const renderResults = (): number => {
    const queryTokens = tokenize(input.value);
    results.replaceChildren();
    if (queryTokens.length === 0) {
      return 0;
    }
    const ranked = searchPublicNotes(publicContent, input.value, 5);
    if (ranked.length === 0) {
      results.append(
        createElement(
          "p",
          "wiki-search-empty",
          "일치하는 승인된 공개 출처가 없습니다. 이 검색은 추측하지 않고 근거만 보여 줍니다.",
        ),
      );
      return 0;
    }
    for (const { note, excerpt } of ranked) {
      const item = createElement("article", "wiki-search-result");
      const meta = createElement("p", "note-meta");
      const displayDate = note.published_at ?? note.updated;
      const time = createElement("time", undefined, formatDate(displayDate));
      time.dateTime = displayDate;
      meta.append(time, document.createTextNode(` · ${note.state}`));
      const title = createElement("h3");
      title.append(attachNoteOpener(item, note));
      item.append(meta, title, createElement("p", "wiki-search-excerpt", excerpt));
      const tagList = createElement("div", "tag-list");
      for (const tag of note.tags) {
        tagList.append(createElement("span", "tag", `#${tag}`));
      }
      item.append(tagList);
      results.append(item);
    }
    results.append(createRouteLink("/garden", "Garden에서 전체 기록 보기", "text-link"));
    return ranked.length;
  };

  const renderAnswer = (payload: AnswerApiResponse): void => {
    const label = payload.mode === "generated" ? "GROUNDED AI ANSWER" : "SAFE RETRIEVAL FALLBACK";
    const heading = payload.mode === "generated" ? "승인된 근거로 생성한 답변" : "생성하지 않고 근거만 표시합니다";
    const sourceList = createElement("ul", "wiki-answer-sources");
    for (const source of payload.sources) {
      sourceList.append(createElement("li", undefined, `${source.title} [${source.id}]`));
    }
    answerPanel.replaceChildren(
      createElement("p", "eyebrow", label),
      createElement("h3", undefined, heading),
      createElement("p", "wiki-answer-copy", payload.answer),
      sourceList,
    );
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    renderResults();
  });
  input.addEventListener("input", renderResults);
  input.addEventListener("input", () => answerPanel.replaceChildren());
  answerButton.addEventListener("click", async () => {
    const query = input.value.trim();
    answerPanel.replaceChildren();
    if (!query || renderResults() === 0) {
      answerPanel.append(createElement("p", "wiki-search-empty", "먼저 근거가 있는 검색어를 입력해 주세요."));
      return;
    }
    answerButton.disabled = true;
    answerButton.textContent = "생성 중…";
    try {
      const response = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) {
        throw new Error(`answer API returned ${response.status}`);
      }
      renderAnswer((await response.json()) as AnswerApiResponse);
    } catch {
      answerPanel.append(
        createElement(
          "p",
          "wiki-search-empty",
          "생성 계층에 연결할 수 없습니다. 위의 retrieval 검색 결과는 계속 확인할 수 있습니다.",
        ),
      );
    } finally {
      answerButton.disabled = false;
      answerButton.textContent = "AI 답변 생성";
    }
  });
  section.append(form, privacyNotice, results, answerPanel);
  return section;
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
        { label: "검색 직접 써보기", href: "#wiki-search", style: "secondary" },
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
      phase: "PHASE 7 · 8A",
      status: "LIVE",
      title: "Public Wiki Retrieval",
      question: "승인된 공개 지식만 검색하고 출처를 함께 보여 줄 수 있는가?",
      result: "외부 LLM 호출 없이 정적 public index를 검색하는 retrieval-only 검색을 이 페이지 아래에서 직접 쓸 수 있습니다.",
    },
    {
      phase: "PHASE 8B",
      status: "LIVE",
      title: "Grounded Answer Layer",
      question: "어떤 provider와 비용·외부 전송 경계가 이 세계관에 맞는가?",
      result: "ADR-0003에 따라 승인된 공개 근거와 질문만 OpenAI Responses API에 전달하며, 비용·남용 방어와 인용 검증을 코드로 강제합니다.",
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
  page.append(experiments, createWikiSearch(), principles);
  return page;
}

function renderGraph(): HTMLElement {
  const page = createElement("div", "page page--graph");
  page.append(
    createHero({
      routeName: "graph",
      kicker: "PUBLIC KNOWLEDGE MAP",
      title: "사람이 검토한 연결을\n읽기 전용 지도로 봅니다.",
      description:
        "승인된 공개 기록과 사람이 선언한 관계만 표시합니다. 자동 추론이나 비공개 지식은 이 지도에 들어오지 않습니다.",
      image: "/assets/constellation-garden.jpg",
      imageAlt: "별자리와 뿌리의 빛으로 연결된 공개 지식의 정원",
      actions: [
        { label: "연결 지도 보기", href: "#knowledge-map", style: "primary" },
        { label: "Garden 기록 보기", href: "/garden", style: "secondary" },
      ],
      note: "이 화면은 content/public/graph.json을 읽을 뿐이며 관계를 추가하거나 수정하지 않습니다.",
    }),
  );

  const mapSection = createElement("section", "content-section knowledge-map-section");
  mapSection.id = "knowledge-map";
  mapSection.tabIndex = -1;
  mapSection.append(
    createSectionHeading(
      "APPROVED CONNECTIONS ONLY",
      "공개 기록이 어떤 생각에서 이어졌는지 살펴보세요.",
      "화살표는 사람이 선언한 관계의 방향을 보존합니다. related_to만 양방향 의미로 읽으며, 연결이 없는 기록도 숨기지 않습니다.",
    ),
    createKnowledgeMap({
      graph: publicGraph,
      notes: publicContent.notes,
      onOpenNote: (note, trigger) => openNoteModal(note, trigger),
    }),
  );
  page.append(mapSection);
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
  for (const phase of phaseDefinitions) {
    const item = createElement("li", "phase-item");
    item.dataset.phaseId = phase.id;
    const footer = createElement("div", "phase-item-footer");
    const detailButton = createElement("button", "phase-detail-button", "자세히 보기");
    detailButton.type = "button";
    detailButton.dataset.phaseId = phase.id;
    detailButton.setAttribute("aria-label", `Phase ${phase.id} ${phase.title} 자세히 보기`);
    detailButton.setAttribute("aria-haspopup", "dialog");
    detailButton.addEventListener("click", () => openPhaseModal(phase, detailButton));
    footer.append(createElement("span", "phase-status", phase.status), detailButton);
    item.append(
      createElement("span", "phase-number", `PHASE ${phase.id}`),
      createElement("h3", undefined, phase.title),
      createElement("p", undefined, phase.summary),
      footer,
    );
    timeline.append(item);
  }
  roadmap.append(timeline, createPhaseLegend());
  page.append(caseStudy, roadmap);
  return page;
}

function createPhaseLegend(): HTMLElement {
  const legend = createElement("aside", "phase-legend");
  legend.setAttribute("aria-label", "Phase 상태 범례");
  legend.append(
    createElement("p", "phase-legend-title", "STATUS LEGEND · 검증의 깊이"),
    createElement(
      "p",
      "phase-legend-intro",
      "상태는 완료 여부가 아니라 어디까지 확인했는지를 보여 줍니다. 오른쪽으로 갈수록 검증이 깊어집니다.",
    ),
  );
  const list = createElement("dl", "phase-legend-grid");
  for (const [label, depth, description] of [
    ["GROWING", 0, "지금 진행 중입니다. 검증은 기록이 쌓인 뒤에 옵니다."],
    ["PASSED", 1, "규칙과 문서가 검사를 통과했습니다."],
    ["VALIDATED", 2, "자동화가 그 규칙을 강제하는지 테스트로 확인했습니다."],
    ["VERIFIED", 3, "실제 운영 환경에서 동작을 확인했습니다."],
    ["LIVE", 4, "지금도 서비스로 운영되고 있습니다."],
  ] as const) {
    const item = createElement("div", "phase-legend-item");
    const term = createElement("dt");
    const meter = createElement("span", "legend-depth");
    meter.setAttribute("aria-hidden", "true");
    for (let step = 1; step <= 4; step += 1) {
      meter.append(createElement("span", step <= depth ? "depth-step is-filled" : "depth-step"));
    }
    term.append(meter, createElement("span", "legend-label", label));
    item.append(term, createElement("dd", undefined, description));
    list.append(item);
  }
  legend.append(list);
  return legend;
}

function pageFor(route: Route): HTMLElement {
  const pages: Record<Route, () => HTMLElement> = {
    "/os": renderOs,
    "/garden": renderGarden,
    "/lab": renderLab,
    "/projects": renderProjects,
    "/graph": renderGraph,
    "/hope": () => renderValueSpace(valueSpaces[0]),
    "/trust": () => renderValueSpace(valueSpaces[1]),
    "/mercy": () => renderValueSpace(valueSpaces[2]),
    "/love": () => renderValueSpace(valueSpaces[3]),
  };
  return pages[route]();
}

function createBrandLogo(size: number): HTMLImageElement {
  const logo = createElement("img", "brand-logo");
  logo.src = "/assets/logo.png";
  logo.alt = "";
  logo.width = size;
  logo.height = size;
  return logo;
}

let livingValuesDrawerCleanup: (() => void) | null = null;

function createLivingValuesDrawer(route: Route): { trigger: HTMLButtonElement; drawer: HTMLElement } {
  const trigger = createElement("button", "living-values-trigger");
  trigger.type = "button";
  trigger.setAttribute("aria-controls", "living-values-drawer");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", "가치 공간 메뉴 열기");

  const drawer = createElement("aside", "living-values-drawer");
  drawer.id = "living-values-drawer";
  drawer.setAttribute("aria-hidden", "true");
  drawer.setAttribute("aria-labelledby", "living-values-drawer-title");
  drawer.inert = true;

  const header = createElement("div", "living-values-drawer-header");
  const headingGroup = createElement("div");
  const heading = createElement("h2", undefined, "가치의 문을 열어 기록으로 들어갑니다.");
  heading.id = "living-values-drawer-title";
  headingGroup.append(
    createElement("p", "eyebrow", "LIVING VALUES"),
    heading,
  );
  header.append(
    headingGroup,
    createElement("p", "living-values-drawer-hint", "글자를 선택하면 승인된 기록이 펼쳐집니다."),
  );

  const valueList = createElement("ul", "living-values-list");
  const entries: Array<{
    tag: string;
    toggle: HTMLButtonElement;
    panel: HTMLElement;
  }> = [];
  let expandedTag: string | null = null;

  const setExpandedTag = (nextTag: string | null): void => {
    expandedTag = nextTag;
    for (const entry of entries) {
      const expanded = entry.tag === expandedTag;
      entry.toggle.setAttribute("aria-expanded", String(expanded));
      entry.panel.classList.toggle("is-open", expanded);
      entry.panel.setAttribute("aria-hidden", String(!expanded));
      entry.panel.inert = !expanded;
    }
  };

  valueSpaces.forEach((value, valueIndex) => {
    const notes = publicContent.notes.filter((note) => note.tags.includes(value.tag));
    const item = createElement("li", "living-values-item");
    item.dataset.value = value.tag;
    item.style.setProperty("--value-order", String(valueIndex));
    // 가치 공간 안에서 메뉴를 열었을 때 지금 어디에 있는지 알 수 있어야 한다.
    const isCurrentSpace = value.path === route;
    if (isCurrentSpace) {
      item.classList.add("is-current");
    }

    const toggle = createElement("button", "living-values-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-controls", `living-values-notes-${value.tag}`);
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute(
      "aria-label",
      isCurrentSpace ? `${value.name} 글 목록 (현재 공간)` : `${value.name} 글 목록`,
    );
    const word = createElement("span", "living-values-word");
    word.append(
      createElement("span", "living-values-initial", value.name.charAt(0)),
      createElement("span", "living-values-word-tail", value.name.slice(1)),
    );
    toggle.append(word, createElement("span", "living-values-count", `${notes.length} records`));

    const panel = createElement("div", "living-values-notes");
    panel.id = `living-values-notes-${value.tag}`;
    panel.setAttribute("aria-hidden", "true");
    panel.inert = true;
    const panelInner = createElement("div", "living-values-notes-inner");
    const noteList = createElement("ul", "living-values-note-list");
    for (const note of notes) {
      const noteItem = createElement("li");
      const noteButton = createElement("button", "living-values-note-button");
      noteButton.type = "button";
      noteButton.dataset.noteId = note.id;
      noteButton.setAttribute("aria-haspopup", "dialog");
      const displayDate = note.published_at ?? note.updated;
      const time = createElement("time", undefined, formatDate(displayDate));
      time.dateTime = displayDate;
      noteButton.append(createElement("span", undefined, note.title), time);
      noteButton.addEventListener("click", () => openNoteModal(note, noteButton));
      noteItem.append(noteButton);
      noteList.append(noteItem);
    }
    const spaceLink = createRouteLink(
      value.path,
      isCurrentSpace ? `${value.name} 가치 공간 처음으로` : `${value.name} 가치 공간 전체 보기`,
      "living-values-space-link",
    );
    if (isCurrentSpace) {
      spaceLink.setAttribute("aria-current", "page");
    }
    panelInner.append(noteList, spaceLink);
    panel.append(panelInner);

    toggle.addEventListener("click", () => {
      setExpandedTag(expandedTag === value.tag ? null : value.tag);
    });
    entries.push({ tag: value.tag, toggle, panel });
    item.append(toggle, panel);
    valueList.append(item);
  });

  drawer.append(header, valueList);
  const controller = new AbortController();
  let drawerOpen = false;
  const setDrawerOpen = (open: boolean, restoreFocus = false): void => {
    drawerOpen = open;
    trigger.setAttribute("aria-expanded", String(open));
    trigger.setAttribute("aria-label", open ? "가치 공간 메뉴 닫기" : "가치 공간 메뉴 열기");
    drawer.classList.toggle("is-open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    drawer.inert = !open;
    if (!open) {
      setExpandedTag(null);
    }
    if (restoreFocus) {
      trigger.focus({ preventScroll: true });
    }
  };

  trigger.addEventListener("click", () => setDrawerOpen(!drawerOpen));
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (
        drawerOpen &&
        activeNoteModalId === null &&
        event.target instanceof Node &&
        !drawer.contains(event.target) &&
        !trigger.contains(event.target)
      ) {
        setDrawerOpen(false);
      }
    },
    { signal: controller.signal },
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && drawerOpen && activeNoteModalId === null) {
        event.preventDefault();
        setDrawerOpen(false, true);
      }
    },
    { signal: controller.signal },
  );

  livingValuesDrawerCleanup = () => controller.abort();
  return { trigger, drawer };
}

function createHeader(route: Route): HTMLElement {
  const header = createElement("header", "site-header");
  const inner = createElement("div", "header-inner");
  const leading = createElement("div", "header-leading");
  const brand = createRouteLink("/os", "", "brand");
  brand.setAttribute("aria-label", "CORCOIDUM OS 홈");
  brand.append(createBrandLogo(28), createElement("span", undefined, "CORCOIDUM OS"));

  // 가치 공간에는 상단 메뉴에 다른 가치로 가는 길이 없으므로, drawer는 모든
  // route에서 제공한다. 여기가 가치 공간 사이를 오가는 유일한 경로다.
  const { trigger, drawer } = createLivingValuesDrawer(route);
  leading.append(trigger, drawer, brand);

  const nav = createElement("nav", "site-nav");
  nav.setAttribute("aria-label", "주요 메뉴");
  for (const item of primaryRouteDefinitions) {
    const link = createRouteLink(item.path, item.label, "nav-link");
    if (item.path === route) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
    nav.append(link);
  }
  inner.append(leading, nav);
  header.append(inner);
  return header;
}

function createFooter(): HTMLElement {
  const footer = createElement("footer", "site-footer");
  const inner = createElement("div", "footer-inner");
  const identity = createElement("div", "footer-identity");
  const footerBrand = createElement("div", "footer-brand");
  footerBrand.append(createBrandLogo(22), createElement("strong", undefined, "CORCOIDUM"));
  identity.append(
    footerBrand,
    createElement(
      "p",
      undefined,
      "Where hearts and codes coexist, the future of technology is human.",
    ),
  );
  const links = createElement("div", "footer-links");
  links.append(
    createRouteLink("/garden", "Garden", "footer-link"),
    createRouteLink("/lab", "Lab", "footer-link"),
    createRouteLink("/projects", "Projects", "footer-link"),
    createRouteLink("/graph", "Map", "footer-link"),
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
  ".wiki-search-form",
  ".principle-item",
  ".case-story-item",
  ".phase-item",
  ".phase-legend",
  ".note-entry",
  ".seed-state",
  ".evidence-links",
  ".dur-note",
  ".knowledge-map-interface",
].join(", ");

let revealCleanup: (() => void) | null = null;

function setupReveals(root: HTMLElement): void {
  revealCleanup?.();
  revealCleanup = null;
  if (prefersReducedMotion()) {
    return;
  }

  const scrollDriven = supportsScrollDrivenAnimations();
  const groupCounts = new Map<HTMLElement | null, number>();
  const targets: HTMLElement[] = [];
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
    targets.push(element);
  });

  if (targets.length === 0 || typeof IntersectionObserver !== "function") {
    // 관찰이 불가능한 환경에서는 콘텐츠가 숨겨진 채 남지 않도록 즉시 공개한다.
    targets.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  let remaining = targets.length;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
        remaining -= 1;
      }
      if (remaining === 0) {
        revealCleanup?.();
        revealCleanup = null;
      }
    },
    // 이전 폴링 구현의 "viewport 상단 92% 안에 들어오면 공개" 기준을 rootMargin으로 유지한다.
    { rootMargin: "0px 0px -8% 0px" },
  );
  targets.forEach((element) => observer.observe(element));
  revealCleanup = () => observer.disconnect();
}

let renderedRoute: Route | null = null;

function render({ announce = false, restoreHistory = false }: RenderOptions = {}): void {
  closeActiveNoteModal?.({ syncHistory: false });
  closeActivePhaseModal?.({ syncHistory: false });
  livingValuesDrawerCleanup?.();
  livingValuesDrawerCleanup = null;
  const route = currentRoute();
  if (window.location.pathname !== route) {
    const url = new URL(window.location.href);
    url.pathname = route;
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
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
  renderedRoute = route;
  syncNoteModalFromLocation();
  syncPhaseModalFromLocation();

  if (announce) {
    window.requestAnimationFrame(() => {
      if (activeNoteModalId !== null || activePhaseModalId !== null) {
        return;
      }
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

const SWIPE_DISTANCE_PX = 72;
const SWIPE_MAX_DURATION_MS = 700;
const SWIPE_AXIS_RATIO = 1.3;
const WHEEL_THRESHOLD_PX = 150;
const WHEEL_SEQUENCE_GAP_MS = 180;
const WHEEL_COOLDOWN_MS = 850;

function gestureTargetIsBlocked(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(
    target.closest(
      "a, button, input, textarea, select, [contenteditable='true'], .constellation-nav, [data-swipe-ignore]",
    ),
  );
}

function navigateAdjacentRoute(direction: "backward" | "forward"): boolean {
  const index = gestureRoutes.indexOf(currentRoute());
  if (index < 0) {
    return false;
  }
  const nextIndex = index + (direction === "forward" ? 1 : -1);
  const route = gestureRoutes[nextIndex];
  if (!route) {
    return false;
  }
  navigate(route, direction);
  return true;
}

function setupRouteGestures(): void {
  let pointerStart: { id: number; x: number; y: number; time: number } | null = null;
  let wheelTotal = 0;
  let lastWheelAt = 0;
  let wheelLockedUntil = 0;

  window.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType !== "touch" || !event.isPrimary || gestureTargetIsBlocked(event.target)) {
        pointerStart = null;
        return;
      }
      pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp };
    },
    { passive: true },
  );

  window.addEventListener(
    "pointerup",
    (event) => {
      if (!pointerStart || event.pointerId !== pointerStart.id) {
        return;
      }
      const start = pointerStart;
      pointerStart = null;
      const deltaX = event.clientX - start.x;
      const deltaY = event.clientY - start.y;
      const duration = event.timeStamp - start.time;
      const horizontal =
        Math.abs(deltaX) >= SWIPE_DISTANCE_PX &&
        Math.abs(deltaX) > Math.abs(deltaY) * SWIPE_AXIS_RATIO;
      if (horizontal && duration <= SWIPE_MAX_DURATION_MS && window.getSelection()?.type !== "Range") {
        navigateAdjacentRoute(deltaX < 0 ? "forward" : "backward");
      }
    },
    { passive: true },
  );
  window.addEventListener("pointercancel", () => {
    pointerStart = null;
  });

  window.addEventListener(
    "wheel",
    (event) => {
      const now = event.timeStamp;
      const scale =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? window.innerWidth
            : 1;
      const deltaX = event.deltaX * scale;
      const deltaY = event.deltaY * scale;
      if (
        now < wheelLockedUntil ||
        gestureTargetIsBlocked(event.target) ||
        Math.abs(deltaX) < 2 ||
        Math.abs(deltaX) <= Math.abs(deltaY) * SWIPE_AXIS_RATIO
      ) {
        if (now - lastWheelAt > WHEEL_SEQUENCE_GAP_MS) {
          wheelTotal = 0;
        }
        return;
      }

      // 앱 내부 route gesture로 판정된 수평 wheel은 브라우저 history gesture와 경쟁하지 않게 막는다.
      event.preventDefault();
      if (now - lastWheelAt > WHEEL_SEQUENCE_GAP_MS || Math.sign(wheelTotal) !== Math.sign(deltaX)) {
        wheelTotal = 0;
      }
      wheelTotal += deltaX;
      lastWheelAt = now;
      if (Math.abs(wheelTotal) >= WHEEL_THRESHOLD_PX) {
        navigateAdjacentRoute(wheelTotal > 0 ? "forward" : "backward");
        wheelTotal = 0;
        wheelLockedUntil = now + WHEEL_COOLDOWN_MS;
      }
    },
    { passive: false },
  );
}

window.addEventListener("popstate", () => {
  if (noteHistoryBackPending && renderedRoute === currentRoute()) {
    noteHistoryBackPending = false;
    syncNoteModalFromLocation();
    syncPhaseModalFromLocation();
    return;
  }
  if (phaseHistoryBackPending && renderedRoute === currentRoute()) {
    phaseHistoryBackPending = false;
    syncNoteModalFromLocation();
    syncPhaseModalFromLocation();
    return;
  }
  noteHistoryBackPending = false;
  phaseHistoryBackPending = false;
  if (
    renderedRoute === currentRoute() &&
    (activeNoteModalId !== null || hasNoteQuery() || activePhaseModalId !== null || hasPhaseQuery())
  ) {
    syncNoteModalFromLocation();
    syncPhaseModalFromLocation();
    return;
  }
  renderWithTransition({ announce: true, restoreHistory: true });
});
setupRouteGestures();
render();
