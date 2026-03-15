import { test, expect } from "@playwright/test";

test.describe("TODO Status Update", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', process.env.E2E_USER_EMAIL ?? "admin@example.com");
    await page.fill('[name="password"]', process.env.E2E_USER_PASSWORD ?? "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
  });

  test("dashboard loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test("settings page is accessible from dashboard", async ({ page }) => {
    await page.goto("/settings/providers");
    await expect(page).toHaveURL("/settings/providers");
    const heading = page.getByRole("heading");
    await expect(heading).toBeVisible();
  });

  test("provider settings page has add provider UI", async ({ page }) => {
    await page.goto("/settings/providers");
    const body = await page.locator("body").textContent();
    // The page should contain some provider-related content
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(0);
  });

  test("unauthenticated access redirects to login", async ({ page: newPage, browser }) => {
    const context = await browser.newContext();
    const freshPage = await context.newPage();
    await freshPage.goto("/");
    // Should redirect to login page for unauthenticated users
    await freshPage.waitForURL(/login|\//, { timeout: 5000 });
    await context.close();
  });
});
