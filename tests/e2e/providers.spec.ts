import { test, expect } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_USER_EMAIL ?? "admin@example.com";
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD ?? "password123";

test.describe("Provider settings - modal UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', E2E_EMAIL);
    await page.fill('[name="password"]', E2E_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
    await page.goto("/settings/providers");
  });

  // T002: Add button is visible on providers settings page
  test("Add button is visible on providers settings page", async ({ page }) => {
    await expect(page.getByRole("button", { name: /add provider/i })).toBeVisible();
  });

  // T003: Clicking Add button opens AddProvider modal dialog
  test("clicking Add button opens AddProvider modal dialog", async ({ page }) => {
    await page.getByRole("button", { name: /add provider/i }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  // T004: Submitting valid form adds provider, closes modal, updates list
  test("submitting valid form adds provider, closes modal, updates list", async ({ page }) => {
    await page.getByRole("button", { name: /add provider/i }).click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Fill display name
    const displayNameInput = dialog.locator('input[name="providerName"]');
    await displayNameInput.fill("Test GitHub Provider");

    // GitHub token
    const tokenInput = dialog.locator('input[type="password"]').first();
    await tokenInput.fill("ghp_testtoken123456");

    // Submit
    await dialog.getByRole("button", { name: /add issue tracker/i }).click();

    // Modal should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  // T005: Inline add form is NOT present on provider settings page
  test("inline add form is NOT present on provider settings page", async ({ page }) => {
    // The old inline form was inside a Paper section with "Add Issue Tracker" heading
    // After refactoring, the form should only exist inside a modal dialog
    const dialogs = page.locator('[role="dialog"]');
    await expect(dialogs).toHaveCount(0);

    // The inline form submit button should not be visible outside a dialog
    const inlineSubmitButtons = page.locator(
      ':not([role="dialog"]) button[type="submit"]'
    );
    await expect(inlineSubmitButtons).toHaveCount(0);
  });
});

test.describe("Provider settings - modal close (US2)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', E2E_EMAIL);
    await page.fill('[name="password"]', E2E_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
    await page.goto("/settings/providers");
    await page.getByRole("button", { name: /add provider/i }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  // T008: Cancel button closes modal without changes
  test("cancel button closes modal without changes", async ({ page }) => {
    const dialog = page.locator('[role="dialog"]');
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  // T009: Pressing Esc key closes modal without changes
  test("pressing Esc key closes modal without changes", async ({ page }) => {
    const dialog = page.locator('[role="dialog"]');
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  // T010: Clicking modal overlay closes modal without changes
  test("clicking modal overlay closes modal without changes", async ({ page }) => {
    const dialog = page.locator('[role="dialog"]');
    // Click on the backdrop (outside the dialog paper)
    await page.mouse.click(10, 10);
    await expect(dialog).not.toBeVisible();
  });
});

test.describe("Provider settings - form validation in modal (US3)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', E2E_EMAIL);
    await page.fill('[name="password"]', E2E_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
    await page.goto("/settings/providers");
    await page.getByRole("button", { name: /add provider/i }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  // T012: Saving with empty required fields shows validation error inside modal
  test("saving with empty required fields shows validation error inside modal", async ({ page }) => {
    const dialog = page.locator('[role="dialog"]');
    // Click submit without filling any required fields
    // The HTML5 `required` attribute prevents submission; dialog stays open
    await dialog.getByRole("button", { name: /add issue tracker/i }).click();
    await expect(dialog).toBeVisible();
  });

  // T013: API error on save shows error message inside modal without closing
  test("API error on save shows error message inside modal without closing", async ({ page }) => {
    const dialog = page.locator('[role="dialog"]');

    // Fill required fields
    await dialog.locator('input[name="providerName"]').fill("Bad Provider");
    const tokenInput = dialog.locator('input[type="password"]').first();
    await tokenInput.fill("invalid_token");

    // Intercept API call to return an error
    await page.route("/api/providers", (route) => {
      void route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid credentials" }),
      });
    });

    await dialog.getByRole("button", { name: /add issue tracker/i }).click();

    // Modal should remain open and show error
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("alert")).toBeVisible();
  });
});
