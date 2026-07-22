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
} from "../src/answer-policy";

type RelationType =
  | "related_to"
  | "builds_on"
  | "supports"
  | "demonstrates"
  | "implemented_by"
  | "uses";

type GraphNode = {
  id: string;
  url: string;
  backlinks: Array<{ source: string; type: RelationType }>;
  related_notes: string[];
};

type PublicGraph = {
  nodes: GraphNode[];
  edges: Array<{ source: string; target: string; type: RelationType }>;
};

const relationLabels: Record<RelationType, string> = {
  related_to: "관련 기록",
  builds_on: "이 기록에서 이어짐",
  supports: "이 기록을 뒷받침함",
  demonstrates: "이 기록을 보여 주는 사례",
  implemented_by: "이 기록을 구현함",
  uses: "이 기록을 활용함",
};

const indexPath = fileURLToPath(new URL("../../content/public/index.json", import.meta.url));
const publicNotes = (
  JSON.parse(readFileSync(indexPath, "utf8")) as {
    notes: Array<{ id: string; title: string; tags: string[] }>;
  }
).notes;
const graphPath = fileURLToPath(new URL("../../content/public/graph.json", import.meta.url));
const publicGraph = JSON.parse(readFileSync(graphPath, "utf8")) as PublicGraph;
const publicNotesById = new Map(publicNotes.map((note) => [note.id, note]));
const firstPublicNote = publicNotes[0];
const primaryRoutes = ["os", "garden", "lab", "projects"] as const;
const valueRoutes = [
  { path: "hope", tag: "hope", name: "H.O.P.E", image: "/assets/value-hope.webp" },
  { path: "trust", tag: "trust", name: "T.R.U.S.T", image: "/assets/value-trust.webp" },
  { path: "mercy", tag: "mercy", name: "M.E.R.C.Y", image: "/assets/value-mercy.webp" },
  { path: "love", tag: "love", name: "L.O.V.E", image: "/assets/value-love.webp" },
] as const;

if (!firstPublicNote) {
  throw new Error("딥링크 테스트에 사용할 공개 노트가 없습니다.");
}

function graphConnections(nodeId: string): Array<{ targetId: string; type: RelationType }> {
  const connections = new Map<string, RelationType>();
  const addConnection = (targetId: string, type: RelationType): void => {
    if (targetId !== nodeId && publicNotesById.has(targetId) && !connections.has(targetId)) {
      connections.set(targetId, type);
    }
  };

  for (const edge of publicGraph.edges) {
    if (edge.source === nodeId) {
      addConnection(edge.target, edge.type);
    }
  }
  const graphNode = publicGraph.nodes.find((node) => node.id === nodeId);
  for (const backlink of graphNode?.backlinks ?? []) {
    addConnection(backlink.source, backlink.type);
  }
  for (const relatedId of graphNode?.related_notes ?? []) {
    addConnection(relatedId, "related_to");
  }
  return Array.from(connections, ([targetId, type]) => ({ targetId, type }));
}

const connectedGraphFixture = publicGraph.nodes
  .map((source) => {
    const connection = graphConnections(source.id)[0];
    const sourceNote = publicNotesById.get(source.id);
    const targetNote = connection ? publicNotesById.get(connection.targetId) : undefined;
    return connection && sourceNote && targetNote ? { source, sourceNote, targetNote, connection } : null;
  })
  .find((fixture) => fixture !== null);
const isolatedGraphFixture = publicGraph.nodes.find(
  (node) => publicNotesById.has(node.id) && graphConnections(node.id).length === 0,
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

  await expect(page.getByRole("heading", { level: 1 })).toContainText("L.O.V.E");
  await expect(page).toHaveTitle("L.O.V.E · 가족 · 일상 · 지속 가능성 | CORCOIDUM OS");
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
    await page.locator(`.value-item[data-value="${value.tag}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/${value.path}$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(value.name);
    await expect(page.locator("#page-title")).toBeFocused();
    await page.goBack();
    await expect(page).toHaveURL(/\/os$/);
    await expect(page.locator("#page-title")).toBeFocused();
  }
});

test("핵심 공간의 공통 header는 Living Values drawer를 제공한다", async ({ page }) => {
  for (const route of ["/os", "/garden", "/lab", "/projects"] as const) {
    await page.goto(route);
    const trigger = page.getByRole("button", { name: "가치 공간 메뉴 열기" });
    const drawer = page.locator("#living-values-drawer");

    await expect(trigger).toBeVisible();
    await expect(drawer).toHaveAttribute("aria-hidden", "true");
    await trigger.click();
    await expect(drawer).toHaveClass(/is-open/);

    const hopeToggle = drawer.getByRole("button", { name: "H.O.P.E 글 목록" });
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

  const loveToggle = drawer.getByRole("button", { name: "L.O.V.E 글 목록" });
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
  await expect(drawer.getByRole("button", { name: "H.O.P.E 글 목록 (현재 공간)" })).toBeVisible();

  await drawer.getByRole("button", { name: "T.R.U.S.T 글 목록" }).click();
  await drawer.getByRole("link", { name: "T.R.U.S.T 가치 공간 전체 보기" }).click();
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
  for (const name of ["H.O.P.E", "T.R.U.S.T", "M.E.R.C.Y", "L.O.V.E"]) {
    const tail = drawer.getByRole("button", { name: `${name} 글 목록` }).locator(".living-values-word-tail");
    await expect(tail).toHaveCSS("opacity", "1");
    await expect(tail).toBeVisible();
  }
});

test("Living Values drawer는 mobile tap으로 전체 단어와 한 목록만 연다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/os");
  await page.getByRole("button", { name: "가치 공간 메뉴 열기" }).click();
  const drawer = page.locator("#living-values-drawer");
  const hopeToggle = drawer.getByRole("button", { name: "H.O.P.E 글 목록" });
  const trustToggle = drawer.getByRole("button", { name: "T.R.U.S.T 글 목록" });

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
    graphConnections(connectedGraphFixture.source.id).length,
  );

  const relation = relations.locator(`[data-note-id="${connectedGraphFixture.targetNote.id}"]`);
  await expect(relation).toContainText(connectedGraphFixture.targetNote.title);
  await expect(relation).toContainText(relationLabels[connectedGraphFixture.connection.type]);
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
  for (const [from, to] of [
    ["os", "garden"],
    ["garden", "lab"],
    ["lab", "projects"],
  ]) {
    await page.goto(`/${from}`);
    await page.evaluate(() => {
      document.querySelector(".site-main")?.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: 330,
          clientY: 420,
          isPrimary: true,
          pointerId: 1,
          pointerType: "touch",
        }),
      );
      window.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          clientX: 180,
          clientY: 425,
          isPrimary: true,
          pointerId: 1,
          pointerType: "touch",
        }),
      );
    });
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
