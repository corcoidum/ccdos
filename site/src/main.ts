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

const publicContent = content as PublicContent;
const routes: Route[] = ["/os", "/garden", "/lab", "/projects"];
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Application root is missing.");
}

const appRoot: HTMLDivElement = app;

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (text) {
    element.textContent = text;
  }
  return element;
}

function currentRoute(): Route {
  return routes.includes(window.location.pathname as Route) ? (window.location.pathname as Route) : "/os";
}

function navigate(route: Route): void {
  window.history.pushState({}, "", route);
  render();
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function formatDate(timestamp: string): string {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(timestamp),
  );
}

function createLink(route: Route, label: string, activeRoute: Route): HTMLAnchorElement {
  const link = createElement("a", label);
  link.href = route;
  link.className = route === activeRoute ? "nav-link active" : "nav-link";
  link.addEventListener("click", (event) => {
    if (!isPlainLeftClick(event)) {
      return;
    }
    event.preventDefault();
    navigate(route);
  });
  return link;
}

function renderNote(note: PublicNote): HTMLElement {
  const article = createElement("article");
  article.className = "note-card";
  article.append(createElement("p", `${formatDate(note.updated)} · ${note.state}`));
  article.querySelector("p")?.classList.add("note-meta");
  article.append(createElement("h3", note.title));

  const tags = createElement("div");
  tags.className = "tags";
  for (const tag of note.tags) {
    const chip = createElement("span", `#${tag}`);
    chip.className = "tag";
    tags.append(chip);
  }
  article.append(tags);

  for (const paragraph of note.body.split(/\n\s*\n/).filter(Boolean)) {
    article.append(createElement("p", paragraph.replace(/^#+\s*/, "")));
  }
  return article;
}

function createPageHeading(eyebrow: string, title: string, description: string): HTMLElement {
  const header = createElement("header");
  header.className = "page-heading";
  header.append(createElement("p", eyebrow), createElement("h1", title), createElement("p", description));
  return header;
}

function renderOs(): HTMLElement {
  const page = createElement("section");
  page.append(
    createPageHeading(
      "CORCOIDUM OS / OVERVIEW",
      "사람의 맥락을 지키는\n작은 기술 시스템",
      "의료 현장의 비식별 운영 인사이트와 개인의 학습·개발 경험을, 검토된 공개 지식으로 연결합니다.",
    ),
  );
  const principles = createElement("section");
  principles.className = "content-section";
  principles.append(createElement("h2", "운영 원칙"));
  const list = createElement("ul");
  for (const item of [
    "보안 경계가 편의성보다 우선합니다.",
    "공개 전에는 반드시 사람의 privacy review를 거칩니다.",
    "승인된 공개 콘텐츠만 외부 시스템에 전달합니다.",
  ]) {
    list.append(createElement("li", item));
  }
  principles.append(list);
  page.append(principles);
  return page;
}

function renderGarden(): HTMLElement {
  const page = createElement("section");
  page.append(
    createPageHeading(
      "CORCOIDUM GARDEN",
      "공개된 기록",
      "사람의 검토와 승인을 마친 콘텐츠만 표시합니다.",
    ),
  );
  const notes = createElement("section");
  notes.className = "content-section";
  if (publicContent.notes.length === 0) {
    const empty = createElement(
      "p",
      "아직 공개 승인된 기록이 없습니다. 검토와 승인이 완료된 콘텐츠만 이곳에 추가됩니다.",
    );
    empty.className = "empty-state";
    notes.append(empty);
  } else {
    const grid = createElement("div");
    grid.className = "note-grid";
    publicContent.notes.forEach((note) => grid.append(renderNote(note)));
    notes.append(grid);
  }
  page.append(notes);
  return page;
}

function renderLab(): HTMLElement {
  const page = createElement("section");
  page.append(
    createPageHeading(
      "CORCOIDUM LAB",
      "작게 만들고\n검증하며 배우기",
      "자동화와 웹 인터페이스는 실제 민감 데이터 없이, 재현 가능한 작은 실험으로 시작합니다.",
    ),
  );
  const grid = createElement("div");
  grid.className = "info-grid content-section";
  for (const [title, body] of [
    ["Knowledge safety", "메타데이터와 privacy review 규칙으로 공개 경계를 확인합니다."],
    ["Publishing pipeline", "승인된 노트만 정적 콘텐츠 index와 사이트로 전달합니다."],
    ["Automation MVP", "상태 보고와 주간 요약은 비식별 정보만 사용하도록 설계합니다."],
  ]) {
    const card = createElement("article");
    card.className = "info-card";
    card.append(createElement("h2", title), createElement("p", body));
    grid.append(card);
  }
  page.append(grid);
  return page;
}

function renderProjects(): HTMLElement {
  const page = createElement("section");
  page.append(
    createPageHeading(
      "CORCOIDUM PROJECTS",
      "공개 가능한\n작은 시스템들",
      "기술 자체보다 현장의 마찰을 줄이고, 사람이 이해할 수 있는 흐름을 우선합니다.",
    ),
  );
  const list = createElement("div");
  list.className = "project-list content-section";
  for (const [phase, title, body] of [
    ["PHASE 1–2", "Safe Knowledge Foundation", "Vault 경계, metadata 검증, 공개 전 사람 검토 규칙"],
    ["PHASE 3–4", "Publishing Pipeline", "CI 검증과 승인된 콘텐츠의 정적 빌드"],
    ["PHASE 5–6", "OS UI & Automation", "공개 사이트 경로, 상태 보고, 주간 운영 요약"],
  ]) {
    const project = createElement("article");
    project.className = "project-item";
    project.append(createElement("p", phase), createElement("h2", title), createElement("p", body));
    list.append(project);
  }
  page.append(list);
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

function render(): void {
  const route = currentRoute();
  if (window.location.pathname !== route) {
    window.history.replaceState({}, "", route);
  }
  const shell = createElement("main");
  const nav = createElement("nav");
  nav.className = "site-nav";
  nav.append(createElement("a", "CORCOIDUM OS"));
  const brand = nav.querySelector("a");
  if (brand) {
    brand.href = "/os";
    brand.className = "brand";
    brand.addEventListener("click", (event) => {
      if (!isPlainLeftClick(event)) {
        return;
      }
      event.preventDefault();
      navigate("/os");
    });
  }
  const links = createElement("div");
  links.className = "nav-links";
  ([
    ["/os", "OS"],
    ["/garden", "Garden"],
    ["/lab", "Lab"],
    ["/projects", "Projects"],
  ] as const).forEach(([path, label]) => links.append(createLink(path, label, route)));
  nav.append(links);
  shell.append(nav, pageFor(route), createElement("footer", "CORCOIDUM OS · Human-centered systems, built carefully."));
  appRoot.replaceChildren(shell);
}

window.addEventListener("popstate", render);
render();
