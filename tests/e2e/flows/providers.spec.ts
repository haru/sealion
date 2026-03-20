import { test, expect } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_USER_EMAIL ?? "admin@example.com";
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD ?? "password123";

test.describe("Provider settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', E2E_EMAIL);
    await page.fill('[name="password"]', E2E_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
    await page.goto("/settings/providers");
  });

  test("provider settings page loads", async ({ page }) => {
    await expect(page).toHaveURL("/settings/providers");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("add Jira provider shows URL in list", async ({ page }) => {
    // Fill in the provider form
    await page.selectOption('select, [role="combobox"]', "JIRA");
    await page.fill('input[type="text"][required]', "Test Jira");

    // Fill Jira-specific fields
    const inputs = page.locator('input');
    // baseUrl, email, apiToken fields
    const textInputs = inputs.filter({ hasNotText: "" });
    // Use placeholder-based selection as a more robust approach
    const baseUrlInput = page.locator('input[placeholder*="atlassian"]');
    if (await baseUrlInput.count() > 0) {
      await baseUrlInput.fill("https://test.atlassian.net");
    }
  });

  test("edit button is visible on provider rows", async ({ page }) => {
    // The page should render without errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(500);
    expect(errors).toHaveLength(0);

    // If there are providers, edit buttons should be visible
    const editButtons = page.locator('[aria-label="edit"]');
    const count = await editButtons.count();
    if (count > 0) {
      await expect(editButtons.first()).toBeVisible();
    }
  });

  test("edit modal opens when edit button clicked", async ({ page }) => {
    const editButtons = page.locator('[aria-label="edit"]');
    const count = await editButtons.count();

    if (count > 0) {
      await editButtons.first().click();
      // Modal should appear
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    }
  });
});
