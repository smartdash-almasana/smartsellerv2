import { test, expect } from "@playwright/test";

test.describe("OAuth start redirect", () => {
  test("navigating to /api/auth/meli/start redirects away from app", async ({ page }) => {
    await page.goto("/api/auth/meli/start", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/mercadolibre\.com(\.ar)?/i, { timeout: 20000 });

    const current = page.url();
    expect(current).toMatch(/mercadolibre\.com(\.ar)?/i);
    expect(current).not.toContain("/enter");
  });
});
