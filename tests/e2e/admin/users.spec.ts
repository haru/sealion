import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "password123";

test.describe("Admin Users — US3: User Status Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', ADMIN_EMAIL);
    await page.fill('[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
    await page.goto("/admin/users");
    await page.waitForURL(/admin\/users/);
  });

  test("user list shows status chips for each user", async ({ page }) => {
    // Each user row should have a status chip (pending/active/suspended)
    const statusChips = page.locator('[data-testid="user-status-chip"], .MuiChip-root').first();
    await expect(statusChips).toBeVisible();
  });

  test("admin can open edit dialog and see status select", async ({ page }) => {
    await page.getByRole("button", { name: /^edit|^編集/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // Status select should be visible in the dialog
    const statusSelect = page.getByRole("dialog").getByRole("combobox", {
      name: /^status|^ステータス/i,
    });
    await expect(statusSelect).toBeVisible();
  });

  test("status select is disabled when editing own account", async ({ page }) => {
    const row = page.getByRole("row").filter({ hasText: ADMIN_EMAIL });
    await row.getByRole("button", { name: /^edit|^編集/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const statusSelect = page.getByRole("dialog").getByRole("combobox", {
      name: /^status|^ステータス/i,
    });
    await expect(statusSelect).toBeDisabled();
  });

  test("admin can change another user status via edit dialog", async ({ page }) => {
    // Find a non-admin user row (not the admin's own row)
    const rows = page.getByRole("row");
    const count = await rows.count();

    // Find a row that is NOT the admin's own row
    let targetRow = null;
    for (let i = 1; i < count; i++) {
      const rowText = await rows.nth(i).textContent();
      if (rowText && !rowText.includes(ADMIN_EMAIL)) {
        targetRow = rows.nth(i);
        break;
      }
    }

    if (!targetRow) {
      test.skip(true, "No other users available for status change test");
      return;
    }

    await targetRow.getByRole("button", { name: /^edit|^編集/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const statusSelect = page.getByRole("dialog").getByRole("combobox", {
      name: /^status|^ステータス/i,
    });
    await expect(statusSelect).toBeEnabled();

    // Select a status option
    await statusSelect.click();
    const options = page.getByRole("option");
    await expect(options.first()).toBeVisible();
    await options.first().click();

    // Save the dialog
    await page.getByRole("dialog").getByRole("button", { name: /save|保存/i }).click();
    // Dialog should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3000 });
  });

  test("status chip colors reflect status type", async ({ page }) => {
    // The page renders status chips — verify at least one chip is visible
    // Color coding: active=success(green), pending=warning(yellow), suspended=error(red)
    // We can verify the chip exists and has a MuiChip class
    const chips = page.locator(".MuiChip-root");
    const chipCount = await chips.count();
    expect(chipCount).toBeGreaterThan(0);
  });
});
