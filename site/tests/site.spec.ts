import { expect, test } from "@playwright/test";

import { boundedDailyLimit, extractOpenAIText, hasValidCitations } from "../src/answer-policy";

test("주요 route가 SPA 안에서 이동한다", async ({ page }) => {
  await page.goto("/os");
  const navigation = page.getByRole("navigation", { name: "주요 메뉴" });
  await navigation.getByRole("link", { name: "Garden" }).click();
  await expect(page).toHaveURL(/\/garden$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("지식의 정원");
});

test("Garden은 처음 두 기록만 보여 주고 펼치기·필터를 지원한다", async ({ page }) => {
  await page.goto("/garden");
  const notes = page.locator("#public-note-list .note-entry");
  const toggle = page.getByRole("button", { name: "기록 3개 더 보기" });

  await expect(notes).toHaveCount(2);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(notes).toHaveCount(5);
  await expect(page.getByRole("button", { name: "기록 접기" })).toHaveAttribute("aria-expanded", "true");

  await page.getByRole("button", { name: "#debugging" }).click();
  await expect(notes).toHaveCount(1);
  await expect(toggle).toBeHidden();
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
  const response = await request.post("/api/answer", { data: { query: "automation" } });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  expect(payload.mode).toBe("retrieval");
  expect(payload.reason).toBe("not_configured");
  expect(payload.sources.length).toBeGreaterThan(0);
});

test("Lab의 AI 답변 버튼도 안전 폴백 상태를 사용자에게 보여 준다", async ({ page }) => {
  await page.goto("/lab");
  await page.getByRole("searchbox", { name: "공개 기록 검색어" }).fill("automation");
  await page.getByRole("button", { name: "AI 답변 생성" }).click();
  await expect(page.getByRole("heading", { name: "생성하지 않고 근거만 표시합니다" })).toBeVisible();
  await expect(page.locator(".wiki-answer-sources li")).not.toHaveCount(0);
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
