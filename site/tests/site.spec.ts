import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import {
  boundedDailyLimit,
  extractOpenAIText,
  hasValidCitations,
  isRetryableProviderFailure,
  ProviderError,
  providerFailureLabel,
  withProviderRetry,
} from "../src/answer-policy";
import {
  connectionsForNote,
  relationLabel,
  type PublicGraph,
  type PublicGraphNode,
} from "../src/graph-view";
import { phaseDefinitions } from "../src/phase-details";
import { publicRecordNumbers, type PublicNote } from "../src/search";

const indexPath = fileURLToPath(new URL("../../content/public/index.json", import.meta.url));
const publicNotes = (
  JSON.parse(readFileSync(indexPath, "utf8")) as { notes: PublicNote[] }
).notes;
const graphPath = fileURLToPath(new URL("../../content/public/graph.json", import.meta.url));
const publicGraph = JSON.parse(readFileSync(graphPath, "utf8")) as PublicGraph;
const publicNotesById = new Map(publicNotes.map((note) => [note.id, note]));
const firstPublicNote = publicNotes[0];
const primaryRoutes = ["os", "garden", "lab", "projects", "graph"] as const;
const valueRoutes = [
  { path: "hope", tag: "hope", name: "H.OPE", image: "/assets/value-hope.webp" },
  { path: "trust", tag: "trust", name: "T.RUST", image: "/assets/value-trust.webp" },
  { path: "mercy", tag: "mercy", name: "M.ERCY", image: "/assets/value-mercy.webp" },
  { path: "love", tag: "love", name: "L.OVE", image: "/assets/value-love.webp" },
] as const;
const valueTitleTokens = {
  hope: "--value-hope",
  trust: "--value-trust",
  mercy: "--value-mercy",
  love: "--value-love",
} as const;

if (!firstPublicNote) {
  throw new Error("딥링크 테스트에 사용할 공개 노트가 없습니다.");
}

const connectedGraphFixture = publicGraph.nodes
  .map((source) => {
    const connection = connectionsForNote(publicGraph, publicNotesById, source.id)[0];
    const sourceNote = publicNotesById.get(source.id);
    const targetNote = connection?.note;
    return connection && sourceNote && targetNote ? { source, sourceNote, targetNote, connection } : null;
  })
  .find((fixture) => fixture !== null);
const isolatedGraphFixture = publicGraph.nodes.find(
  (node) =>
    publicNotesById.has(node.id) &&
    connectionsForNote(publicGraph, publicNotesById, node.id).length === 0,
);

// 로컬 .dev.vars에 실제 키가 있으면 아래 계약 테스트가 유료 provider를 호출하므로 건너뛴다. CI에는 키가 없어 항상 실행된다.
const devVarsPath = fileURLToPath(new URL("../.dev.vars", import.meta.url));
const hasLocalOpenAIKey =
  existsSync(devVarsPath) && /^\s*OPENAI_API_KEY\s*=/m.test(readFileSync(devVarsPath, "utf8"));

test("주요 route가 SPA 안에서 이동한다", async ({ page }) => {
  await page.goto("/os");
  const navigation = page.getByRole("navigation", { name: "주요 메뉴" });
  await navigation.getByRole("link", { name: "Garden" }).click();
  await expect(page).toHaveURL(/\/garden$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("지식의 정원");
});

test("/love 직접 접속은 가치 히어로와 실제 love 기록을 보여 준다", async ({ page }) => {
  const loveNotes = publicNotes.filter((note) => note.tags.includes("love"));
  await page.goto("/love");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("L.OVE");
  await expect(page).toHaveTitle("L.OVE · 가족 · 일상 · 지속 가능성 | CORCOIDUM OS");
  await expect(page.locator(".skip-link")).toHaveAttribute("href", "#main-content");
  await expect(page.locator(".value-growth-label")).toHaveText("자라는 중");
  await expect(page.locator("#value-note-list-love .note-entry")).toHaveCount(loveNotes.length);
});

test("네 가치 공간은 서로 다른 전용 3:2 hero 이미지를 사용한다", async ({ page }) => {
  const sources: string[] = [];

  for (const value of valueRoutes) {
    await page.goto(`/${value.path}`);
    const heroImage = page.locator(".hero-visual img");
    await expect(heroImage).toHaveAttribute("src", value.image);
    await expect(heroImage).toHaveAttribute("alt", /.+/);

    const image = await heroImage.evaluate((element) => ({
      complete: element.complete,
      naturalWidth: element.naturalWidth,
      naturalHeight: element.naturalHeight,
      objectFit: getComputedStyle(element).objectFit,
    }));
    expect(image.complete).toBeTruthy();
    expect(image.naturalWidth).toBe(1536);
    expect(image.naturalHeight).toBe(1024);
    expect(image.objectFit).toBe("contain");
    const source = await heroImage.getAttribute("src");
    sources.push(source ?? "");
  }

  expect(new Set(sources).size).toBe(valueRoutes.length);
  expect(sources.every((source) => !source.includes("constellation-"))).toBeTruthy();
});

test("OS의 네 가지 약속 카드는 각각의 가치 공간으로 이동한다", async ({ page }) => {
  for (const value of valueRoutes) {
    await page.goto("/os");
    const card = page.locator(`.value-item[data-value="${value.tag}"]`);
    // 가치 이름이 그 가치의 색을 입고, 한글 약속은 흰색으로 읽혀야 한다.
    await expect(card.locator(".value-name")).toHaveText(value.name);
    const colors = await card.evaluate((element, token) => {
      const probe = document.createElement("span");
      document.body.append(probe);
      const resolve = (declaration: string): string => {
        probe.style.color = declaration;
        return getComputedStyle(probe).color;
      };
      const name = element.querySelector(".value-name");
      const title = element.querySelector("h3");
      if (!name || !title) {
        throw new Error("가치 카드에 이름 또는 약속 문구가 없습니다.");
      }
      const measured = {
        name: getComputedStyle(name).color,
        accent: resolve(`var(${token})`),
        title: getComputedStyle(title).color,
        ivory: resolve("var(--ivory-strong)"),
      };
      probe.remove();
      return measured;
    }, valueTitleTokens[value.tag]);
    expect(colors.name).toBe(colors.accent);
    expect(colors.title).toBe(colors.ivory);
    expect(colors.title).not.toBe(colors.accent);
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/${value.path}$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(value.name);
    await expect(page.locator("#page-title")).toBeFocused();
    await page.goBack();
    await expect(page).toHaveURL(/\/os$/);
    await expect(page.locator("#page-title")).toBeFocused();
  }
});

test("핵심 공간의 공통 header는 Living Values drawer를 제공한다", async ({ page }) => {
  for (const route of ["/os", "/garden", "/lab", "/projects", "/graph"] as const) {
    await page.goto(route);
    const trigger = page.getByRole("button", { name: "가치 공간 메뉴 열기" });
    const drawer = page.locator("#living-values-drawer");

    await expect(trigger).toBeVisible();
    await expect(drawer).toHaveAttribute("aria-hidden", "true");
    await trigger.click();
    await expect(drawer).toHaveClass(/is-open/);

    const hopeToggle = drawer.getByRole("button", { name: "H.OPE 글 목록" });
    await hopeToggle.click();
    await expect(hopeToggle).toHaveAttribute("aria-expanded", "true");
    await expect(
      drawer.locator("#living-values-notes-hope .living-values-note-button"),
    ).toHaveCount(publicNotes.filter((note) => note.tags.includes("hope")).length);

    if (route === "/projects") {
      const firstHopeNote = publicNotes.find((note) => note.tags.includes("hope"));
      if (!firstHopeNote) {
        throw new Error("공통 Living Values drawer 테스트에 사용할 hope 기록이 없습니다.");
      }
      await drawer.getByRole("button", { name: firstHopeNote.title }).click();
      await expect(page).toHaveURL(new RegExp(`/projects\\?note=${firstHopeNote.id}$`));
      await expect(page.getByRole("dialog")).toContainText(firstHopeNote.title);
      await page.getByRole("button", { name: "닫기" }).click();
      await expect(drawer).toHaveClass(/is-open/);
    }
  }
});

test("공통 header는 원본 브랜드 마크와 모바일 touch target을 유지한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/os");

  const logo = page.locator(".brand .brand-logo");
  await expect(logo).toHaveAttribute("src", "/assets/logo.png");
  await expect(page.locator(".brand")).toHaveAttribute("aria-label", "CORCOIDUM OS 홈");

  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) {
        throw new Error(`${selector} is missing`);
      }
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, width: bounds.width, height: bounds.height };
    };
    return {
      brand: rect(".brand"),
      trigger: rect(".living-values-trigger"),
    };
  });

  expect(geometry.brand.height).toBeGreaterThanOrEqual(44);
  expect(geometry.trigger.width).toBeGreaterThanOrEqual(44);
  expect(geometry.trigger.height).toBeGreaterThanOrEqual(44);
  expect(geometry.brand.left).toBeLessThan(geometry.trigger.left);
});

test("OS의 Living Values drawer는 가치 단어와 승인 기록을 바로 펼친다", async ({ page }) => {
  await page.goto("/os");
  const trigger = page.locator(".living-values-trigger");
  const drawer = page.locator("#living-values-drawer");
  await expect(trigger).toHaveAttribute("aria-label", "가치 공간 메뉴 열기");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(drawer).toHaveAttribute("aria-hidden", "true");

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(drawer).toHaveClass(/is-open/);

  for (const value of valueRoutes) {
    const toggle = drawer.getByRole("button", { name: `${value.name} 글 목록` });
    const expectedNotes = publicNotes.filter((note) => note.tags.includes(value.tag));
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle.locator(".living-values-word-tail")).toHaveCSS("opacity", "1");
    await expect(
      drawer.locator(`#living-values-notes-${value.tag} .living-values-note-button`),
    ).toHaveCount(expectedNotes.length);
  }

  const loveToggle = drawer.getByRole("button", { name: "L.OVE 글 목록" });
  await expect(loveToggle).toHaveAttribute("aria-expanded", "true");
  const firstLoveNote = publicNotes.find((note) => note.tags.includes("love"));
  if (!firstLoveNote) {
    throw new Error("Living Values drawer 테스트에 사용할 love 기록이 없습니다.");
  }
  await drawer.getByRole("button", { name: firstLoveNote.title }).click();
  await expect(page.getByRole("dialog")).toContainText(firstLoveNote.title);
  await page.getByRole("button", { name: "닫기" }).click();
  await expect(drawer).toHaveClass(/is-open/);

  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
});

test("가치 공간에서도 drawer로 다른 가치 공간에 바로 갈 수 있다", async ({ page }) => {
  // 가치 공간의 상단 메뉴에는 다른 가치로 가는 길이 없어, drawer가 유일한 경로다.
  for (const route of ["/hope", "/trust", "/mercy", "/love"] as const) {
    await page.goto(route);
    await expect(page.getByRole("button", { name: "가치 공간 메뉴 열기" })).toBeVisible();
  }

  await page.goto("/hope");
  await page.getByRole("button", { name: "가치 공간 메뉴 열기" }).click();
  const drawer = page.locator("#living-values-drawer");

  // 지금 머무는 공간이 표시되어야 위치를 잃지 않는다.
  await expect(drawer.locator(".living-values-item.is-current")).toHaveAttribute("data-value", "hope");
  await expect(drawer.getByRole("button", { name: "H.OPE 글 목록 (현재 공간)" })).toBeVisible();

  await drawer.getByRole("button", { name: "T.RUST 글 목록" }).click();
  await drawer.getByRole("link", { name: "T.RUST 가치 공간 전체 보기" }).click();
  await expect(page).toHaveURL(/\/trust$/);

  // 이동한 뒤에는 표시도 함께 옮겨가야 한다.
  await page.getByRole("button", { name: "가치 공간 메뉴 열기" }).click();
  await expect(page.locator("#living-values-drawer .living-values-item.is-current")).toHaveAttribute(
    "data-value",
    "trust",
  );
});

test("touch 기기에서는 값 이름이 접히지 않고 처음부터 전부 보인다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/os");
  await page.getByRole("button", { name: "가치 공간 메뉴 열기" }).click();
  const drawer = page.locator("#living-values-drawer");

  // hover 예고가 없는 기기에서 "H·T·M·L" 한 글자만 남으면 의미를 알 수 없다.
  for (const name of ["H.OPE", "T.RUST", "M.ERCY", "L.OVE"]) {
    const tail = drawer.getByRole("button", { name: `${name} 글 목록` }).locator(".living-values-word-tail");
    await expect(tail).toHaveCSS("opacity", "1");
    await expect(tail).toBeVisible();
  }
});

// 이 저장소의 Playwright project는 Pixel 7 하나뿐이라 touch 규칙이 늘 적용된다.
// hover 연출은 desktop context를 따로 세워야 실제로 검증할 수 있다.
test.describe("pointer가 있는 화면", () => {
  // devices["Desktop Chrome"]를 통째로 쓰면 defaultBrowserType까지 바뀌어 describe 안에서
  // 쓸 수 없다. hover 규칙을 여는 데 필요한 context 옵션만 지정한다.
  test.use({ viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false });

  test("머리글자에 hover하면 나머지 글자가 펼쳐진다", async ({ page }) => {
    await page.goto("/os");
    await page.getByRole("button", { name: "가치 공간 메뉴 열기" }).click();
    const drawer = page.locator("#living-values-drawer");
    const tailWidth = async (name: string): Promise<number> =>
      drawer
        .getByRole("button", { name: `${name} 글 목록` })
        .locator(".living-values-word-tail")
        .evaluate((node) => node.getBoundingClientRect().width);

    for (const [name, tail] of [
      ["H.OPE", ".ope"],
      ["T.RUST", ".rust"],
      ["M.ERCY", ".ercy"],
      ["L.OVE", ".ove"],
    ] as const) {
      const toggle = drawer.getByRole("button", { name: `${name} 글 목록` });
      const tailNode = toggle.locator(".living-values-word-tail");

      // 펼쳐지는 꼬리는 소문자여야 "H" 뒤에 ".ope"가 이어붙는 한 낱말로 읽힌다.
      await expect(tailNode).toHaveText(tail);
      await expect(tailNode).toHaveCSS("opacity", "0");
      const collapsed = await tailWidth(name);
      expect(collapsed).toBeLessThan(1);

      await toggle.hover();
      await expect(tailNode).toHaveCSS("opacity", "1");
      // 낱말마다 제 폭까지만 열려야 하므로, 펼친 뒤 너비는 글자 수를 따라간다.
      await expect.poll(async () => tailWidth(name)).toBeGreaterThan(collapsed + 10);
    }

    // hover를 거두면 다시 머리글자만 남는다.
    await page.locator(".living-values-drawer-header").hover();
    await expect
      .poll(async () => tailWidth("H.OPE"))
      .toBeLessThan(1);
  });
});

test("Living Values drawer는 mobile tap으로 전체 단어와 한 목록만 연다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/os");
  await page.getByRole("button", { name: "가치 공간 메뉴 열기" }).click();
  const drawer = page.locator("#living-values-drawer");
  const hopeToggle = drawer.getByRole("button", { name: "H.OPE 글 목록" });
  const trustToggle = drawer.getByRole("button", { name: "T.RUST 글 목록" });

  await hopeToggle.click();
  await expect(hopeToggle.locator(".living-values-word-tail")).toHaveCSS("opacity", "1");
  await expect(hopeToggle).toHaveAttribute("aria-expanded", "true");
  await trustToggle.click();
  await expect(hopeToggle).toHaveAttribute("aria-expanded", "false");
  await expect(trustToggle).toHaveAttribute("aria-expanded", "true");
  await expect(drawer).toBeInViewport();
});

test("같은 페이지 CTA는 hash target으로 이동하고 keyboard focus를 넘긴다", async ({ page }) => {
  await page.goto("/lab");
  await page.getByRole("link", { name: "검색 직접 써보기" }).click();
  await expect(page).toHaveURL(/\/lab#wiki-search$/);
  await expect(page.locator("#wiki-search")).toBeFocused();
  expect(await page.locator("#wiki-search").evaluate((element) => getComputedStyle(element).scrollMarginTop)).not.toBe(
    "0px",
  );
});

test("Garden은 처음 두 기록만 보여 주고 펼치기·필터를 지원한다", async ({ page }) => {
  const initialLimit = 2;
  const total = publicNotes.length;
  await page.goto("/garden");
  const notes = page.locator("#public-note-list .note-entry");
  const toggle = page.locator(".archive-toggle");

  await expect(notes).toHaveCount(Math.min(total, initialLimit));
  if (total > initialLimit) {
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveText(`기록 ${total - initialLimit}개 더 보기`);
    await toggle.click();
    await expect(page.getByRole("button", { name: "기록 접기" })).toHaveAttribute("aria-expanded", "true");
  }
  await expect(notes).toHaveCount(total);

  // 기록 번호는 가장 오래된 기록이 01이고, 최신순 정렬에서 빠짐없이 내려간다.
  const numbers = await page.locator("#public-note-list .note-number").allTextContents();
  expect(numbers.map(Number)).toEqual(publicNotes.map((_, index) => total - index));

  // 실제 데이터에서 가장 드물게 쓰인 태그로 필터 동작을 검증한다.
  const tagCounts = new Map<string, number>();
  for (const note of publicNotes) {
    for (const tag of note.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const [rarestTag, rarestCount] = [...tagCounts.entries()].sort((a, b) => a[1] - b[1])[0];
  await page.getByRole("button", { name: `#${rarestTag}` }).click();
  await expect(notes).toHaveCount(Math.min(rarestCount, initialLimit));
  if (rarestCount <= initialLimit) {
    await expect(toggle).toBeHidden();
  }
});

test("Garden 기록을 클릭하면 URL과 전문 모달이 열리고 Esc로 포커스와 함께 닫힌다", async ({ page }) => {
  await page.goto("/garden");
  const opener = page.locator("#public-note-list .note-open-button").first();
  const title = (await opener.textContent()) ?? "";
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(new URL(page.url()).searchParams.get("note")).toBe(firstPublicNote.id);
  await expect(dialog.getByRole("heading", { name: title })).toBeVisible();
  expect(await dialog.locator(".note-modal-body p").count()).toBeGreaterThan(0);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/garden$/);
  await expect(opener).toBeFocused();
});

test("노트 딥링크로 직접 접속하면 해당 전문 모달을 연다", async ({ page }) => {
  await page.goto(`/garden?note=${firstPublicNote.id}`);

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: firstPublicNote.title })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("note")).toBe(firstPublicNote.id);
});

test("노트 모달을 연 뒤 브라우저 뒤로가기를 하면 모달과 query가 함께 닫힌다", async ({ page }) => {
  await page.goto("/garden");
  const opener = page.locator(
    `#public-note-list [data-note-id="${firstPublicNote.id}"]`,
  );
  await opener.click();
  await expect(page).toHaveURL(new RegExp(`/garden\\?note=${firstPublicNote.id}$`));

  await page.goBack();

  await expect(page).toHaveURL(/\/garden$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("노트 모달이 열린 상태에서 SPA route를 이동하면 모달과 query를 정리한다", async ({ page }) => {
  await page.goto("/garden");
  await page
    .locator(`#public-note-list [data-note-id="${firstPublicNote.id}"]`)
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.locator('.site-nav a[href="/lab"]').evaluate((link) => {
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
  });

  await expect(page).toHaveURL(/\/lab$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("존재하지 않는 노트 딥링크는 모달 없이 query를 조용히 제거한다", async ({ page }) => {
  await page.goto("/garden?note=not-a-public-note");

  await expect(page).toHaveURL(/\/garden$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("공통 graph model은 방향과 같은 node 사이의 복수 관계를 보존한다", () => {
  const note = (id: string, title: string): PublicNote => ({
    id,
    title,
    updated: "2026-07-22T00:00:00Z",
    published_at: "2026-07-22T00:00:00Z",
    tags: ["trust"],
    state: "published",
    body: `${title} 본문`,
  });
  const graphNode = (id: string, label: string): PublicGraphNode => ({
    id,
    type: "note",
    label,
    url: `/garden?note=${id}`,
    tags: ["trust"],
    state: "published",
    updated: "2026-07-22T00:00:00Z",
    published_at: "2026-07-22T00:00:00Z",
    backlinks: [],
    related_notes: [],
  });
  const notes = [note("branch", "이어진 기록"), note("base", "기반 기록"), note("peer", "관련 기록")];
  const notesById = new Map(notes.map((entry) => [entry.id, entry]));
  const syntheticGraph: PublicGraph = {
    version: 2,
    nodes: notes.map((entry) => graphNode(entry.id, entry.title)),
    edges: [
      { source: "branch", target: "base", type: "builds_on" },
      { source: "branch", target: "base", type: "supports" },
      { source: "branch", target: "peer", type: "related_to" },
    ],
  };

  const outgoing = connectionsForNote(syntheticGraph, notesById, "branch");
  expect(outgoing.filter(({ note: target }) => target.id === "base")).toHaveLength(2);
  expect(outgoing.find(({ type }) => type === "builds_on")?.direction).toBe("outgoing");
  expect(relationLabel("builds_on", "outgoing")).toBe("이 기록의 기반");
  expect(connectionsForNote(syntheticGraph, notesById, "base")[0].direction).toBe("incoming");
  expect(relationLabel("builds_on", "incoming")).toBe("이 기록에서 이어짐");
  expect(connectionsForNote(syntheticGraph, notesById, "peer")[0].direction).toBe("undirected");
});

test("/graph는 승인된 공개 node와 edge를 읽기 전용으로 탐색한다", async ({ page }) => {
  await page.goto("/graph");

  await expect(page).toHaveTitle("읽기 전용 지식 연결 지도 | CORCOIDUM OS");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("사람이 검토한 연결");
  await expect(page.locator(".knowledge-map-node")).toHaveCount(publicGraph.nodes.length);
  await expect(page.locator(".knowledge-map-edge:not(.is-hidden)")).toHaveCount(
    publicGraph.edges.length,
  );
  await expect(page.locator(".knowledge-map-status")).toContainText(
    `승인된 공개 기록 ${publicGraph.nodes.length}개`,
  );

  const firstEdge = publicGraph.edges[0];
  if (!firstEdge) {
    throw new Error("Knowledge Map 필터 테스트에 사용할 공개 edge가 없습니다.");
  }
  await page.getByRole("combobox", { name: "Relation type 필터" }).selectOption(firstEdge.type);
  await expect(page.locator(".knowledge-map-edge:not(.is-hidden)")).toHaveCount(
    publicGraph.edges.filter((edge) => edge.type === firstEdge.type).length,
  );

  await page.getByRole("combobox", { name: "Living Value 필터" }).selectOption("trust");
  const trustCount = publicGraph.nodes.filter((node) => node.tags.includes("trust")).length;
  await expect(page.locator(".knowledge-map-index li:not([hidden])")).toHaveCount(
    Math.min(4, trustCount),
  );
  if (trustCount > 4) {
    await page.locator(".knowledge-map-index-more").click();
    await expect(page.locator(".knowledge-map-index li:not([hidden])")).toHaveCount(trustCount);
  }

  const selected = page.locator(".knowledge-map-index li:not([hidden]) button").first();
  const selectedId = await selected.getAttribute("data-node-id");
  if (!selectedId) {
    throw new Error("Knowledge Map에서 선택할 공개 node가 없습니다.");
  }
  await selected.click();
  await page.getByRole("button", { name: "전문 읽기" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("note")).toBe(selectedId);
});

test("Map 목록과 node는 Garden의 최신 기록 순서와 번호를 공유한다", async ({ page }) => {
  const graphNodeIds = new Set(publicGraph.nodes.map((node) => node.id));
  const expectedNotes = publicNotes.filter((note) => graphNodeIds.has(note.id));
  const recordNumbers = publicRecordNumbers(publicNotes);
  const expectedNumbers = expectedNotes.map((note) =>
    String(recordNumbers.get(note.id)).padStart(2, "0"),
  );

  await page.goto("/graph");

  const indexButtons = page.locator(".knowledge-map-index-button");
  const indexNoteIds = await indexButtons.evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("data-node-id")),
  );
  expect(indexNoteIds).toEqual(expectedNotes.map((note) => note.id));
  expect(await page.locator(".knowledge-map-index-number").allTextContents()).toEqual(expectedNumbers);
  expect(await page.locator(".knowledge-map-node-number").allTextContents()).toEqual(expectedNumbers);

  const visibleNoteIds = () =>
    page.locator(".knowledge-map-index li:not([hidden]) .knowledge-map-index-button").evaluateAll(
      (buttons) => buttons.map((button) => button.getAttribute("data-node-id")),
    );
  let visibleCount = Math.min(4, expectedNotes.length);
  expect(await visibleNoteIds()).toEqual(
    expectedNotes.slice(0, visibleCount).map((note) => note.id),
  );

  const moreButton = page.locator(".knowledge-map-index-more");
  while (visibleCount < expectedNotes.length) {
    const nextCount = Math.min(4, expectedNotes.length - visibleCount);
    await expect(moreButton).toHaveAccessibleName(
      new RegExp(`공개 기록 ${nextCount}개 더 보기`),
    );
    await moreButton.click();
    visibleCount += nextCount;
    expect(await visibleNoteIds()).toEqual(
      expectedNotes.slice(0, visibleCount).map((note) => note.id),
    );
  }
  await expect(moreButton).toBeHidden();

  const numberColors = await page.evaluate(() => {
    const number = document.querySelector<HTMLElement>(".knowledge-map-index-number");
    if (!number) {
      throw new Error("Knowledge Map 공개 기록 번호가 없습니다.");
    }
    const probe = document.createElement("span");
    probe.style.color = "var(--gold-soft)";
    document.body.append(probe);
    const colors = {
      number: getComputedStyle(number).color,
      gold: getComputedStyle(probe).color,
    };
    probe.remove();
    return colors;
  });
  expect(numberColors.number).toBe(numberColors.gold);
});

test("Map node는 선택 시 해당 Living Value 색과 gold 관계선을 사용한다", async ({ page }) => {
  const valueTokens = {
    hope: "--value-hope",
    trust: "--value-trust",
    mercy: "--value-mercy",
    love: "--value-love",
  } as const;
  const valueTags = Object.keys(valueTokens) as Array<keyof typeof valueTokens>;

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/graph");

  for (const graphNode of publicGraph.nodes) {
    const expectedValue = valueTags.find((value) => graphNode.tags.includes(value));
    if (!expectedValue) {
      throw new Error(`${graphNode.id}에 Living Value tag가 없습니다.`);
    }
    await expect(
      page.locator(`.knowledge-map-node[data-node-id="${graphNode.id}"]`),
    ).toHaveAttribute("data-value", expectedValue);
  }

  for (const value of valueTags) {
    const graphNode = publicGraph.nodes.find((node) => node.tags.includes(value));
    if (!graphNode) {
      throw new Error(`${value} 색상 테스트에 사용할 graph node가 없습니다.`);
    }
    const node = page.locator(`.knowledge-map-node[data-node-id="${graphNode.id}"]`);
    await node.click();
    await expect(node).toHaveClass(/is-selected/);
    await expect
      .poll(async () =>
        node.locator(".knowledge-map-node-core").evaluate(
          (core, token) => {
            const probe = document.createElement("span");
            probe.style.color = `var(${token})`;
            document.body.append(probe);
            const matches = getComputedStyle(core).fill === getComputedStyle(probe).color;
            probe.remove();
            return matches;
          },
          valueTokens[value],
        ),
      )
      .toBe(true);
  }

  const firstEdge = publicGraph.edges[0];
  if (!firstEdge) {
    throw new Error("활성 관계선 색상 테스트에 사용할 edge가 없습니다.");
  }
  const sourceNode = page.locator(
    `.knowledge-map-node[data-node-id="${firstEdge.source}"]`,
  );
  await sourceNode.click();
  await expect
    .poll(async () =>
      page.locator(".knowledge-map-edge.is-active").first().evaluate((edge) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--gold-soft)";
        document.body.append(probe);
        const matches = getComputedStyle(edge).stroke === getComputedStyle(probe).color;
        probe.remove();
        return matches;
      }),
    )
    .toBe(true);

  const targetNode = publicGraph.nodes.find((node) => node.id === firstEdge.target);
  const targetValue = targetNode
    ? valueTags.find((value) => targetNode.tags.includes(value))
    : undefined;
  if (!targetNode || !targetValue) {
    throw new Error("연결 node의 Living Value를 확인할 수 없습니다.");
  }
  await expect
    .poll(async () =>
      page
        .locator(`.knowledge-map-node[data-node-id="${targetNode.id}"] .knowledge-map-node-core`)
        .evaluate(
          (core, token) => {
            const probe = document.createElement("span");
            probe.style.color = `var(${token})`;
            document.body.append(probe);
            const matches = getComputedStyle(core).stroke === getComputedStyle(probe).color;
            probe.remove();
            return matches;
          },
          valueTokens[targetValue],
        ),
    )
    .toBe(true);
});

test("모바일 Knowledge Map은 제목 목록을 4개씩 펼친다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/graph");

  await expect(page.locator(".knowledge-map-canvas")).toBeHidden();
  await expect(page.locator(".knowledge-map-index")).toBeVisible();
  await expect(page.locator(".knowledge-map-index-button")).toHaveCount(publicGraph.nodes.length);
  await expect(page.locator(".knowledge-map-index li:not([hidden])")).toHaveCount(
    Math.min(4, publicGraph.nodes.length),
  );

  const moreButton = page.locator(".knowledge-map-index-more");
  if (publicGraph.nodes.length > 4) {
    const bounds = await moreButton.boundingBox();
    expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(44);
    await moreButton.focus();
    await moreButton.press("Enter");
    await expect(page.locator(".knowledge-map-index li:not([hidden])")).toHaveCount(
      Math.min(8, publicGraph.nodes.length),
    );
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("그래프 연결이 있는 노트는 이어지는 기록에서 같은 모달로 이동한다", async ({ page }) => {
  test.skip(!connectedGraphFixture, "graph.json에 연결된 공개 노트가 없습니다.");
  if (!connectedGraphFixture) {
    return;
  }

  await page.goto(connectedGraphFixture.source.url);
  const dialog = page.getByRole("dialog");
  const relations = dialog.locator(".note-relations");
  await expect(relations.getByRole("heading", { name: "이어지는 기록" })).toBeVisible();
  await expect(relations.locator(".note-relation-button")).toHaveCount(
    connectionsForNote(publicGraph, publicNotesById, connectedGraphFixture.source.id).length,
  );

  const relation = relations.locator(`[data-note-id="${connectedGraphFixture.targetNote.id}"]`);
  await expect(relation).toContainText(connectedGraphFixture.targetNote.title);
  await expect(relation).toContainText(
    relationLabel(
      connectedGraphFixture.connection.type,
      connectedGraphFixture.connection.direction,
    ),
  );
  await relation.click();

  await expect(page.getByRole("dialog")).toHaveCount(1);
  const targetHeading = dialog.getByRole("heading", {
    level: 2,
    name: connectedGraphFixture.targetNote.title,
  });
  await expect(targetHeading).toBeVisible();
  await expect(targetHeading).toBeFocused();
  expect(new URL(page.url()).searchParams.get("note")).toBe(connectedGraphFixture.targetNote.id);
  const modalWidth = await dialog.locator(".note-modal-scroll").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(modalWidth.scrollWidth).toBeLessThanOrEqual(modalWidth.clientWidth);
});

test("그래프 연결이 없는 노트에는 이어지는 기록 섹션을 렌더링하지 않는다", async ({ page }) => {
  test.skip(!isolatedGraphFixture, "graph.json에 연결이 없는 공개 노트가 없습니다.");
  if (!isolatedGraphFixture) {
    return;
  }

  await page.goto(isolatedGraphFixture.url);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".note-relations")).toHaveCount(0);
  await expect(dialog.getByRole("heading", { name: "이어지는 기록" })).toHaveCount(0);
});

test("Lab 검색 결과를 클릭하면 같은 모달로 전문을 읽고 닫기 버튼으로 닫는다", async ({ page }) => {
  await page.goto("/lab");
  await page.getByRole("searchbox", { name: "공개 기록 검색어" }).fill("automation");
  const opener = page.locator(".wiki-search-result .note-open-button").first();
  await expect(opener).toBeVisible();
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.locator(".note-modal-body p").count()).toBeGreaterThan(0);

  await dialog.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("가치 공간을 제외한 touch swipe와 trackpad wheel 순환은 기존 route 순서를 유지한다", async ({ page }) => {
  for (const [from, to, startX, endX] of [
    ["os", "garden", 330, 180],
    ["garden", "lab", 330, 180],
    ["lab", "projects", 330, 180],
    ["projects", "graph", 330, 180],
    ["graph", "projects", 180, 330],
  ] as const) {
    await page.goto(`/${from}`);
    await page.evaluate(({ startX, endX }) => {
      document.querySelector(".site-main")?.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: startX,
          clientY: 420,
          isPrimary: true,
          pointerId: 1,
          pointerType: "touch",
        }),
      );
      window.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          clientX: endX,
          clientY: 425,
          isPrimary: true,
          pointerId: 1,
          pointerType: "touch",
        }),
      );
    }, { startX, endX });
    await expect(page).toHaveURL(new RegExp(`/${to}$`));
  }

  await page.goto("/garden");
  await page.evaluate(() => {
    window.dispatchEvent(new WheelEvent("wheel", { cancelable: true, deltaX: 170, deltaY: 5 }));
  });
  await expect(page).toHaveURL(/\/lab$/);

  await page.goto("/love");
  await page.evaluate(() => {
    window.dispatchEvent(new WheelEvent("wheel", { cancelable: true, deltaX: 170, deltaY: 5 }));
  });
  await expect(page).toHaveURL(/\/love$/);
});

test("Projects 로드맵은 네 가지 상태의 뜻을 범례로 설명한다", async ({ page }) => {
  await page.goto("/projects");
  const legend = page.locator(".phase-legend");
  await expect(legend).toBeVisible();
  await expect(legend.locator(".legend-label")).toHaveText([
    "GROWING",
    "PASSED",
    "VALIDATED",
    "VERIFIED",
    "LIVE",
  ]);
  await expect(legend.locator(".phase-legend-item dd")).toHaveCount(5);
  // 검증 깊이 게이지는 단계마다 한 칸씩 더 차오른다.
  const filled = legend.locator(".phase-legend-item");
  for (const [index, expected] of [0, 1, 2, 3, 4].entries()) {
    await expect(filled.nth(index).locator(".depth-step.is-filled")).toHaveCount(expected);
  }
});

test("Phase 0–9 상세 데이터는 공개 증거와 필수 설명을 모두 가진다", () => {
  expect(phaseDefinitions.map(({ id }) => id)).toEqual([
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
  ]);
  for (const phase of phaseDefinitions) {
    expect(phase.purpose.length).toBeGreaterThan(20);
    expect(phase.delivered.length).toBeGreaterThanOrEqual(2);
    expect(phase.boundaries.length).toBeGreaterThanOrEqual(2);
    expect(phase.evidence.length).toBeGreaterThanOrEqual(2);
    expect(
      phase.evidence.every(
        ({ href, label, sourceLabel, summary }) =>
          href.startsWith("https://") &&
          label.trim().length > 0 &&
          sourceLabel.trim().length > 0 &&
          summary.trim().length > 20,
      ),
    ).toBeTruthy();
    expect(phase.outcome.length).toBeGreaterThan(20);
  }
});

test("Projects Phase 카드는 하나의 공통 상세 dialog와 focus 복원을 사용한다", async ({
  page,
}) => {
  await page.goto("/projects");
  await expect(page.locator(".phase-item")).toHaveCount(phaseDefinitions.length);
  await expect(page.locator(".phase-detail-button")).toHaveCount(phaseDefinitions.length);
  await expect(page.locator('[data-phase-id="3"] h3')).toHaveText("Public Content CI Gate");
  await expect(page.locator('[data-phase-id="4"] h3')).toHaveText(
    "Approved Publishing Pipeline",
  );

  const trigger = page.getByRole("button", {
    name: "Phase 0 Architecture Charter 자세히 보기",
  });
  await trigger.click();
  await expect(page).toHaveURL(/\/projects\?phase=0#roadmap$/);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { level: 2 })).toHaveText("Architecture Charter");
  await expect(dialog.getByRole("heading", { name: "목적" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "구현" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "안전 경계" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "검증과 증거" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "결과" })).toBeVisible();
  const evidenceItems = dialog.locator(".phase-modal-evidence-item");
  await expect(evidenceItems).toHaveCount(2);
  await expect(evidenceItems.first().locator(".phase-modal-evidence-source")).toHaveText(
    "출처 · GitHub",
  );
  await expect(evidenceItems.first().locator(".phase-modal-evidence-summary")).toContainText(
    "restricted data의 외부 전송 금지",
  );
  const evidenceLink = evidenceItems.first().locator(".phase-modal-evidence-link");
  await expect(evidenceLink).toHaveText("GitHub 원문 보기 →");
  await expect(evidenceLink).not.toHaveAttribute("target", "_blank");
  await expect(evidenceLink).toHaveAttribute(
    "href",
    "https://github.com/corcoidum/ccdos/blob/main/docs/architecture/phase-0-completion-report.md",
  );
  await expect(page.locator(".evidence-links a").first()).toHaveAttribute("target", "_blank");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/projects$/);
  await expect(trigger).toBeFocused();
});

test("Phase evidence 원문은 새 탭 없이 이동하고 뒤로가기로 dialog에 복귀한다", async ({
  page,
}) => {
  await page.route("https://github.com/**", async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: "<title>GitHub evidence fixture</title><main>Public evidence document</main>",
    });
  });
  await page.goto("/projects?phase=0#roadmap");

  const pageCount = page.context().pages().length;
  await page.getByRole("link", { name: /Phase 0 완료 보고서/ }).click();
  await expect(page).toHaveURL(
    "https://github.com/corcoidum/ccdos/blob/main/docs/architecture/phase-0-completion-report.md",
  );
  expect(page.context().pages()).toHaveLength(pageCount);

  await page.goBack();
  await expect(page).toHaveURL(/\/projects\?phase=0#roadmap$/);
  await expect(page.getByRole("dialog")).toContainText("Architecture Charter");
});

test("Phase deep link와 브라우저 뒤로가기는 dialog 상태를 URL과 동기화한다", async ({
  page,
}) => {
  await page.goto("/projects?phase=8#roadmap");
  await expect(page.getByRole("dialog")).toContainText("Grounded Answer Layer");
  await page.getByRole("button", { name: "닫기" }).click();
  await expect(page).toHaveURL(/\/projects#roadmap$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const trigger = page.getByRole("button", {
    name: "Phase 9 Living Values 자세히 보기",
  });
  await trigger.click();
  await expect(page).toHaveURL(/phase=9/);
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/projects#roadmap$/);

  await page.goto("/projects?phase=unknown#roadmap");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/projects#roadmap$/);
});

test("모바일 Phase 상세는 전체 화면에서 가로 overflow 없이 읽힌다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects?phase=9#roadmap");

  const dialog = page.locator(".phase-modal");
  await expect(dialog).toBeVisible();
  const geometry = await page.evaluate(() => {
    const modal = document.querySelector<HTMLElement>(".phase-modal");
    if (!modal) throw new Error("Phase modal is missing");
    const rect = modal.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  expect(geometry.width).toBe(geometry.viewportWidth);
  expect(geometry.height).toBe(geometry.viewportHeight);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  await expect(dialog).toContainText("PASSED");
  await expect(dialog).toContainText("네 가치 모두 승인·발행 기록 3편 이상");
  await expect(dialog.locator(".phase-modal-evidence-summary").first()).toBeVisible();
  const evidenceLink = dialog.locator(".phase-modal-evidence-link").first();
  const linkBox = await evidenceLink.boundingBox();
  expect(linkBox?.height ?? 0).toBeGreaterThanOrEqual(44);
});

test("모든 route가 모바일 viewport에서 전역 수평 overflow를 만들지 않는다", async ({ page }) => {
  for (const route of [...primaryRoutes, ...valueRoutes.map(({ path }) => path)]) {
    await page.goto(`/${route}`);
    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  }
});

test("Hero와 본문은 모든 대표 viewport에서 같은 fluid shell을 사용한다", async ({ page }) => {
  const routes = [...primaryRoutes, ...valueRoutes.map(({ path }) => path)];
  const viewports = [
    { width: 1536, height: 1024 },
    { width: 1024, height: 900 },
    { width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(`/${route}`);
      const geometry = await page.evaluate(() => {
        const rectOf = (selector: string) => {
          const rect = document.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
          if (!rect) {
            throw new Error(`${selector} is missing`);
          }
          return { left: rect.left, right: rect.right, width: rect.width };
        };
        return {
          header: rectOf(".header-inner"),
          hero: rectOf(".hero-inner"),
          content: rectOf(".content-section"),
          viewportWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        };
      });

      for (const frame of [geometry.header, geometry.content]) {
        expect(Math.abs(frame.left - geometry.hero.left)).toBeLessThanOrEqual(1);
        expect(Math.abs(frame.right - geometry.hero.right)).toBeLessThanOrEqual(1);
        expect(Math.abs(frame.width - geometry.hero.width)).toBeLessThanOrEqual(1);
      }
      expect(geometry.hero.width).toBeLessThan(geometry.viewportWidth);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    }
  }
});

test("별자리 원본은 모든 화면에서 잘리지 않고 ambient backdrop만 hero를 채운다", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1306, height: 810 },
    { width: 1280, height: 800 },
    { width: 1120, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/os");
    const geometry = await page.evaluate(() => {
      const rect = (selector: string) => {
        const bounds = document.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
        if (!bounds) {
          throw new Error(`${selector} is missing`);
        }
        return {
          top: bounds.top,
          right: bounds.right,
          bottom: bounds.bottom,
          left: bounds.left,
          width: bounds.width,
          height: bounds.height,
        };
      };
      return {
        visual: rect(".hero-visual"),
        frame: rect(".hero-frame"),
        image: rect(".hero-visual img"),
        naturalRatio: (() => {
          const image = document.querySelector<HTMLImageElement>(".hero-visual img")!;
          return image.naturalWidth / image.naturalHeight;
        })(),
        nodeFrames: [...document.querySelectorAll<HTMLElement>(".constellation-node")].map(
          (node) => {
            const bounds = node.getBoundingClientRect();
            return {
              top: bounds.top,
              right: bounds.right,
              bottom: bounds.bottom,
              left: bounds.left,
            };
          },
        ),
        backdrop: getComputedStyle(document.querySelector<HTMLElement>(".hero-visual")!, "::before")
          .backgroundImage,
        objectFit: getComputedStyle(document.querySelector<HTMLImageElement>(".hero-visual img")!)
          .objectFit,
      };
    });

    for (const edge of ["right", "left"] as const) {
      expect(Math.abs(geometry.frame[edge] - geometry.visual[edge])).toBeLessThanOrEqual(1);
    }
    for (const edge of ["top", "right", "bottom", "left"] as const) {
      expect(Math.abs(geometry.image[edge] - geometry.frame[edge])).toBeLessThanOrEqual(1);
    }
    expect(geometry.frame.top).toBeGreaterThanOrEqual(geometry.visual.top - 1);
    expect(geometry.frame.bottom).toBeLessThanOrEqual(geometry.visual.bottom + 1);
    expect(geometry.frame.width / geometry.frame.height).toBeCloseTo(geometry.naturalRatio, 2);
    expect(geometry.naturalRatio).toBeCloseTo(1.5, 2);
    expect(geometry.objectFit).toBe("contain");
    expect(geometry.backdrop).not.toBe("none");
    for (const node of geometry.nodeFrames) {
      expect(node.left).toBeGreaterThanOrEqual(geometry.frame.left - 1);
      expect(node.right).toBeLessThanOrEqual(geometry.frame.right + 1);
      expect(node.top).toBeGreaterThanOrEqual(geometry.frame.top - 1);
      expect(node.bottom).toBeLessThanOrEqual(geometry.frame.bottom + 1);
    }
  }

  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/os");
  const stacked = await page.locator(".hero-visual img").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const visual = element.closest<HTMLElement>(".hero-visual")!;
    return {
      width: bounds.width,
      height: bounds.height,
      objectFit: getComputedStyle(element).objectFit,
      backdropDisplay: getComputedStyle(visual, "::before").display,
    };
  });
  expect(stacked.width / stacked.height).toBeCloseTo(1.5, 2);
  expect(stacked.objectFit).toBe("contain");
  expect(stacked.backdropDisplay).toBe("none");
});

test("OS desktop hero는 메시지와 지도를 균형 잡힌 두 열로 보여 준다", async ({ page }) => {
  const expectedAreas = new Map([
    ["OS", { x: [0.58, 0.76], y: [0, 0.24], href: "/os" }],
    ["Garden", { x: [0.18, 0.44], y: [0.34, 0.64], href: "/garden" }],
    ["Lab", { x: [0.78, 1], y: [0.32, 0.64], href: "/lab" }],
    ["Projects", { x: [0.5, 0.82], y: [0.72, 1], href: "/projects" }],
  ]);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1120, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/os");
    const geometry = await page.evaluate(() => {
      const bounds = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) {
          throw new Error(`${selector} is missing`);
        }
        const rect = element.getBoundingClientRect();
        return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
      };
      const frame = bounds(".hero--os .hero-frame");
      return {
        hero: bounds(".hero--os .hero-inner"),
        copy: bounds(".hero--os .hero-copy"),
        visual: bounds(".hero--os .hero-visual"),
        visualBorderRadius: Number.parseFloat(getComputedStyle(document.querySelector<HTMLElement>(".hero--os .hero-visual")!).borderTopLeftRadius),
        frame,
        image: bounds(".hero--os .hero-visual img"),
        navigation: bounds(".hero--os .constellation-nav"),
        nodes: [...document.querySelectorAll<HTMLAnchorElement>(".hero--os .constellation-node")].map(
          (node) => {
            const rect = node.getBoundingClientRect();
            return {
              label: node.textContent?.trim() ?? "",
              href: node.getAttribute("href"),
              x: (rect.left + rect.width / 2 - frame.left) / frame.width,
              y: (rect.top + rect.height / 2 - frame.top) / frame.height,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
              height: rect.height,
            };
          },
        ),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });

    expect(Math.abs(geometry.copy.left - geometry.hero.left)).toBeLessThanOrEqual(1);
    const columnGap = geometry.visual.left - (geometry.copy.left + geometry.copy.width);
    expect(columnGap).toBeGreaterThanOrEqual(30);
    expect(columnGap).toBeLessThanOrEqual(73);
    expect(geometry.visual.width).toBeGreaterThan(geometry.hero.width * 0.48);
    expect(geometry.visual.width).toBeLessThan(geometry.hero.width * 0.56);
    expect(
      Math.abs(geometry.copy.width + columnGap + geometry.visual.width - geometry.hero.width),
    ).toBeLessThanOrEqual(1);
    expect(geometry.visual.top).toBeGreaterThan(geometry.hero.top);
    expect(geometry.visual.top + geometry.visual.height).toBeLessThan(
      geometry.hero.top + geometry.hero.height,
    );
    expect(
      Math.abs(
        geometry.visual.top +
          geometry.visual.height / 2 -
          (geometry.hero.top + geometry.hero.height / 2),
      ),
    ).toBeLessThanOrEqual(1);
    expect(geometry.visualBorderRadius).toBeGreaterThanOrEqual(18);
    expect(geometry.frame.width / geometry.frame.height).toBeCloseTo(1.5, 2);
    for (const edge of ["top", "left", "width", "height"] as const) {
      expect(Math.abs(geometry.image[edge] - geometry.frame[edge])).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.navigation[edge] - geometry.frame[edge])).toBeLessThanOrEqual(1);
    }
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);

    for (const node of geometry.nodes) {
      const expected = expectedAreas.get(node.label);
      expect(expected, `${node.label} 위치 계약이 없습니다.`).toBeDefined();
      if (!expected) {
        continue;
      }
      expect(node.href).toBe(expected.href);
      expect(node.x).toBeGreaterThanOrEqual(expected.x[0]);
      expect(node.x).toBeLessThanOrEqual(expected.x[1]);
      expect(node.y).toBeGreaterThanOrEqual(expected.y[0]);
      expect(node.y).toBeLessThanOrEqual(expected.y[1]);
      expect(node.left).toBeGreaterThanOrEqual(geometry.frame.left - 1);
      expect(node.right).toBeLessThanOrEqual(geometry.frame.left + geometry.frame.width + 1);
      expect(node.top).toBeGreaterThanOrEqual(geometry.frame.top - 1);
      expect(node.bottom).toBeLessThanOrEqual(geometry.frame.top + geometry.frame.height + 1);
      expect(node.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test("모바일 OS 지도는 네 공간 링크와 Projects를 한 줄에 유지한다", async ({ page }) => {
  for (const viewport of [
    { width: 430, height: 900 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
    { width: 320, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/os");
    const geometry = await page.evaluate(() => {
      const bounds = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) {
          throw new Error(`${selector} is missing`);
        }
        const rect = element.getBoundingClientRect();
        return {
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };
      };
      const navigation = document.querySelector<HTMLElement>(".hero--os .constellation-nav")!;
      return {
        frame: bounds(".hero--os .hero-frame"),
        image: bounds(".hero--os .hero-visual img"),
        navigation: bounds(".hero--os .constellation-nav"),
        navigationColumns: getComputedStyle(navigation).gridTemplateColumns.split(" ").length,
        nodes: [...document.querySelectorAll<HTMLAnchorElement>(".hero--os .constellation-node")].map(
          (node) => {
            const rect = node.getBoundingClientRect();
            return {
              label: node.textContent?.trim() ?? "",
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              left: rect.left,
              height: rect.height,
              whiteSpace: getComputedStyle(node).whiteSpace,
            };
          },
        ),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });

    expect(geometry.image.width / geometry.image.height).toBeCloseTo(1.5, 2);
    expect(geometry.navigation.top).toBeGreaterThanOrEqual(geometry.image.bottom - 1);
    expect(Math.abs(geometry.frame.bottom - geometry.navigation.bottom)).toBeLessThanOrEqual(1);
    expect(geometry.navigationColumns).toBe(4);
    expect(geometry.nodes.map((node) => node.label)).toEqual(["OS", "Garden", "Lab", "Projects"]);
    expect(
      Math.max(...geometry.nodes.map((node) => node.top)) -
        Math.min(...geometry.nodes.map((node) => node.top)),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.max(...geometry.nodes.map((node) => node.bottom)) -
        Math.min(...geometry.nodes.map((node) => node.bottom)),
    ).toBeLessThanOrEqual(1);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    for (const node of geometry.nodes) {
      expect(node.left).toBeGreaterThanOrEqual(geometry.navigation.left - 1);
      expect(node.right).toBeLessThanOrEqual(geometry.navigation.right + 1);
      expect(node.height).toBeGreaterThanOrEqual(44);
      expect(node.whiteSpace).toBe("nowrap");
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/os");
  await page
    .getByRole("navigation", { name: "별자리 공간 바로가기" })
    .getByRole("link", { name: "Projects" })
    .click();
  await expect(page).toHaveURL(/\/projects$/);
});

test("근거 답변 API는 Secret이 없을 때 retrieval-only로 폴백한다", async ({ request }) => {
  test.skip(hasLocalOpenAIKey, "로컬 .dev.vars에 OPENAI_API_KEY가 있어 not_configured 계약을 검증할 수 없다");
  const response = await request.post("/api/answer", { data: { query: "automation" } });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  expect(payload.mode).toBe("retrieval");
  expect(payload.reason).toBe("not_configured");
  expect(payload.sources.length).toBeGreaterThan(0);
});

test("Lab의 AI 답변 버튼도 안전 폴백 상태를 사용자에게 보여 준다", async ({ page }) => {
  test.skip(hasLocalOpenAIKey, "로컬 .dev.vars에 OPENAI_API_KEY가 있어 실제 provider 호출을 피하기 위해 건너뛴다");
  await page.goto("/lab");
  await page.getByRole("searchbox", { name: "공개 기록 검색어" }).fill("automation");
  await page.getByRole("button", { name: "AI 답변 생성" }).click();
  await expect(page.getByRole("heading", { name: "생성하지 않고 근거만 표시합니다" })).toBeVisible();
  await expect(page.locator(".wiki-answer-sources li")).not.toHaveCount(0);
});

test("정의되지 않은 /api 경로는 SPA HTML 대신 JSON 404를 돌려준다", async ({ request }) => {
  const response = await request.get("/api/unknown");
  expect(response.status()).toBe(404);
  expect(response.headers()["content-type"]).toContain("application/json");
});

test("근거가 없는 질문은 provider 호출 없이 거부한다", async ({ request }) => {
  const response = await request.post("/api/answer", { data: { query: "존재하지않는완전무관검색어" } });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  expect(payload.mode).toBe("retrieval");
  expect(payload.reason).toBe("no_sources");
  expect(payload.sources).toEqual([]);
});

test("생성 정책은 허용된 source ID 인용과 안전한 일일 상한만 통과시킨다", () => {
  const sources = [{ id: "approved-source" }];
  expect(hasValidCitations("근거가 있는 답변입니다. [approved-source]", sources)).toBeTruthy();
  expect(hasValidCitations("인용이 없는 답변입니다.", sources)).toBeFalsy();
  expect(hasValidCitations("허용되지 않은 인용입니다. [private-source]", sources)).toBeFalsy();
  expect(hasValidCitations("허용 인용과 위조 인용이 섞였습니다. [approved-source] [가짜출처]", sources)).toBeFalsy();
  expect(hasValidCitations("빈 인용도 위조로 봅니다. [approved-source] []", sources)).toBeFalsy();
  expect(boundedDailyLimit("250")).toBe(250);
  expect(boundedDailyLimit("0")).toBe(200);
  expect(boundedDailyLimit("not-a-number")).toBe(200);
});

test("provider 실패는 질문·키 없이 진단 가능한 유형으로만 요약된다", () => {
  expect(providerFailureLabel(new ProviderError("http", 404))).toBe("http_404");
  expect(providerFailureLabel(new ProviderError("http", 401))).toBe("http_401");
  expect(providerFailureLabel(new ProviderError("network"))).toBe("network");

  const timeout = new Error("The operation timed out");
  timeout.name = "TimeoutError";
  expect(providerFailureLabel(timeout)).toBe("timeout");

  const aborted = new Error("aborted");
  aborted.name = "AbortError";
  expect(providerFailureLabel(aborted)).toBe("timeout");

  // 예상 못 한 오류의 메시지가 그대로 새어 나가지 않아야 한다.
  expect(providerFailureLabel(new Error("sk-secret-key-leaked"))).toBe("unknown");
  expect(providerFailureLabel("문자열 오류")).toBe("unknown");
});

test("일시적 provider 실패만 재시도하고 429·본문 오류는 즉시 폴백한다", () => {
  // egress 위치에 따라 오는 403과 provider 과부하는 다시 시도할 가치가 있다.
  expect(isRetryableProviderFailure(new ProviderError("http", 403))).toBeTruthy();
  expect(isRetryableProviderFailure(new ProviderError("http", 503))).toBeTruthy();
  expect(isRetryableProviderFailure(new ProviderError("network"))).toBeTruthy();

  // 재시도가 상황을 악화시키거나 결과가 같은 실패는 즉시 폴백한다.
  expect(isRetryableProviderFailure(new ProviderError("http", 429))).toBeFalsy();
  expect(isRetryableProviderFailure(new ProviderError("http", 401))).toBeFalsy();
  expect(isRetryableProviderFailure(new ProviderError("http", 400))).toBeFalsy();
  expect(isRetryableProviderFailure(new Error("unexpected"))).toBeFalsy();
});

test("실제 fetch network·timeout 예외를 재시도 가능한 ProviderError로 분류한다", async () => {
  const retryOptions = {
    attempts: 3,
    attemptTimeoutMs: 200,
    deadlineMs: 1_000,
    retryDelayMs: 0,
  };
  let networkAttempts = 0;
  const networkResult = await withProviderRetry(async () => {
    networkAttempts += 1;
    if (networkAttempts === 1) {
      throw new TypeError("fetch failed");
    }
    return "network recovered";
  }, retryOptions);
  expect(networkResult).toBe("network recovered");
  expect(networkAttempts).toBe(2);

  let timeoutAttempts = 0;
  const timeoutResult = await withProviderRetry(async () => {
    timeoutAttempts += 1;
    if (timeoutAttempts === 1) {
      throw new DOMException("timed out", "TimeoutError");
    }
    return "timeout recovered";
  }, retryOptions);
  expect(timeoutResult).toBe("timeout recovered");
  expect(timeoutAttempts).toBe(2);
});

test("provider retry 전체 시도는 하나의 deadline을 넘지 않는다", async () => {
  const startedAt = Date.now();
  const result = withProviderRetry(
    (signal) =>
      new Promise<string>((_resolve, reject) => {
        const rejectOnAbort = () => reject(signal.reason);
        if (signal.aborted) {
          rejectOnAbort();
        } else {
          signal.addEventListener("abort", rejectOnAbort, { once: true });
        }
      }),
    {
      attempts: 3,
      attemptTimeoutMs: 1_000,
      deadlineMs: 40,
      retryDelayMs: 0,
    },
  );

  await expect(result).rejects.toMatchObject({ kind: "timeout" });
  expect(Date.now() - startedAt).toBeLessThan(500);
});

test("OpenAI Responses API의 message output만 안전하게 추출한다", () => {
  expect(
    extractOpenAIText({
      output: [
        { type: "reasoning", content: [] },
        {
          type: "message",
          content: [
            { type: "output_text", text: " 승인된 근거입니다. [approved-source] " },
            { type: "refusal" },
          ],
        },
      ],
    }),
  ).toBe("승인된 근거입니다. [approved-source]");
  expect(extractOpenAIText({ output: [{ type: "message", content: [{ type: "refusal" }] }] })).toBe("");
});
