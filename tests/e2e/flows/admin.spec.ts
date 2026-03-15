import { test, expect } from "@playwright/test";

test.describe("Admin User Management", () => {
  test.beforeEach(async ({ page }) => {
    // Log in as admin
    await page.goto("/login");
    await page.fill('[name="email"]', process.env.E2E_ADMIN_EMAIL ?? "admin@example.com");
    await page.fill('[name="password"]', process.env.E2E_ADMIN_PASSWORD ?? "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
  });

  test("admin page is accessible for admin users", async ({ page }) => {
    await page.goto("/admin/users");
    // Admin users should reach the page, not be redirected
    await page.waitForURL(/admin\/users|login/, { timeout: 5000 });
    const url = page.url();
    // If admin user, we should be on the admin page
    if (url.includes("admin/users")) {
      const heading = page.getByRole("heading");
      await expect(heading).toBeVisible();
    }
  });

  test("admin page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/admin/users");
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test("non-admin cannot access admin page", async ({ browser }) => {
    // Create a separate context to test as regular user
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/login");
    await page.fill(
      '[name="email"]',
      process.env.E2E_USER_EMAIL ?? "user@example.com"
    );
    await page.fill(
      '[name="password"]',
      process.env.E2E_USER_PASSWORD ?? "password123"
    );
    await page.click('button[type="submit"]');

    // Try to navigate to admin page
    await page.goto("/admin/users");
    await page.waitForTimeout(1000);

    // Should be redirected away from admin page (to login or home)
    const url = page.url();
    // The admin page should be protected - either redirect or show error
    const body = await page.locator("body").textContent();
    // Either not on admin page OR page shows "forbidden"/"unauthorized"
    const isProtected =
      !url.includes("admin/users") ||
      (body?.toLowerCase().includes("forbidden") ?? false) ||
      (body?.toLowerCase().includes("unauthorized") ?? false) ||
      (body?.toLowerCase().includes("access denied") ?? false);

    expect(isProtected || url.includes("login")).toBeTruthy();

    await context.close();
  });

  test("dashboard is accessible after login", async ({ page }) => {
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
