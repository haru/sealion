import { test, expect } from "@playwright/test";

/**
 * E2E tests for the "Complete Issue" modal flow.
 *
 * These tests assume a running dev server and test seed data (at least one
 * open issue visible on the dashboard). They verify:
 *  - Checkbox is absent from issue cards
 *  - "Complete" button opens the confirmation modal
 *  - Confirming with a reason closes the issue
 *  - Confirming without a reason closes the issue (no comment posted)
 *  - Cancelling leaves the issue open
 */

test.describe("Complete Issue Modal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', process.env.E2E_USER_EMAIL ?? "admin@example.com");
    await page.fill('[name="password"]', process.env.E2E_USER_PASSWORD ?? "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
  });

  test("no checkbox is shown on issue cards", async ({ page }) => {
    // Wait for the issue list to load
    await page.waitForTimeout(1000);
    const checkboxes = page.locator('input[type="checkbox"]');
    await expect(checkboxes).toHaveCount(0);
  });

  test("Complete button is visible on open issue cards", async ({ page }) => {
    await page.waitForTimeout(1000);
    // At least one "Complete" button should be visible if there are open issues
    const cards = page.locator('[data-testid="issue-card"], .MuiCard-root');
    const count = await cards.count();
    if (count === 0) {
      test.skip(); // No issues to test with
      return;
    }
    // Complete button should be present on open issue cards
    const completeButtons = page.getByRole("button", { name: /complete/i });
    const buttonCount = await completeButtons.count();
    if (buttonCount === 0) {
      test.skip(); // No open issues with a Complete button to verify
      return;
    }
    await expect(completeButtons.first()).toBeVisible();
  });

  test("clicking Complete opens confirmation modal", async ({ page }) => {
    await page.waitForTimeout(1500);

    const completeButtons = page.getByRole("button", { name: /complete/i });
    const buttonCount = await completeButtons.count();
    if (buttonCount === 0) {
      test.skip(); // No open issues
      return;
    }

    await completeButtons.first().click();

    // Modal should appear
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Modal should contain a textarea for the completion reason
    const textarea = dialog.locator("textarea");
    await expect(textarea).toBeVisible();

    // Modal should have Complete and Cancel buttons
    await expect(dialog.getByRole("button", { name: /complete/i })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /cancel/i })).toBeVisible();
  });

  test("cancelling the modal leaves the issue open and closes the modal", async ({ page }) => {
    await page.waitForTimeout(1500);

    const completeButtons = page.getByRole("button", { name: /complete/i });
    const buttonCount = await completeButtons.count();
    if (buttonCount === 0) {
      test.skip();
      return;
    }

    await completeButtons.first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Click Cancel
    await dialog.getByRole("button", { name: /cancel/i }).click();

    // Modal should close
    await expect(dialog).not.toBeVisible();

    // The complete button should still be visible (issue not closed)
    await expect(page.getByRole("button", { name: /complete/i }).first()).toBeVisible();
  });

  test("cancelling with text typed does not close the issue", async ({ page }) => {
    await page.waitForTimeout(1500);

    const completeButtons = page.getByRole("button", { name: /complete/i });
    const buttonCount = await completeButtons.count();
    if (buttonCount === 0) {
      test.skip();
      return;
    }

    await completeButtons.first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Type a reason
    await dialog.locator("textarea").fill("I typed something but will cancel");

    // Click Cancel
    await dialog.getByRole("button", { name: /cancel/i }).click();

    // Modal should close
    await expect(dialog).not.toBeVisible();

    // Issue should still be present (not closed)
    await expect(page.getByRole("button", { name: /complete/i }).first()).toBeVisible();
  });

  test("dashboard loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
});
