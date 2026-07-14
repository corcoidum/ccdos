import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { boundedDailyLimit, extractOpenAIText, hasValidCitations } from "../src/answer-policy";

const indexPath = fileURLToPath(new URL("../../content/public/index.json", import.meta.url));
const publicNotes = (JSON.parse(readFileSync(indexPath, "utf8")) as { notes: Array<{ tags: string[] }> })
  .notes;

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

test("touch swipe와 trackpad wheel이 인접 route로 한 번만 이동한다", async ({ page }) => {
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
  for (const route of ["os", "garden", "lab", "projects"]) {
    await page.goto(`/${route}`);
    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  }
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
