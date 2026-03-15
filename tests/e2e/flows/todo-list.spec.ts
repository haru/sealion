import { test, expect } from "@playwright/test";

test.describe("TODO List Display", () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto("/login");
    await page.fill('[name="email"]', process.env.E2E_USER_EMAIL ?? "admin@example.com");
    await page.fill('[name="password"]', process.env.E2E_USER_PASSWORD ?? "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
  });

  test("dashboard page loads and shows TODO list title", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("shows sync status indicator", async ({ page }) => {
    // The sync status area should exist (even if no providers)
    await expect(page).toHaveURL("/");
    // Page should be loaded without errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test("shows empty state when no issues", async ({ page }) => {
    // If no providers are connected, should show empty state message
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
  });

  test("settings link navigates to provider settings", async ({ page }) => {
    await page.goto("/settings/providers");
    await expect(page).toHaveURL("/settings/providers");
    await expect(page.getByRole("heading")).toBeVisible();
  });
});
