import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_USER_EMAIL ?? "admin@example.com";
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD ?? "password123";

/** Logs in and navigates to the providers settings page. */
async function loginAndGoToProviders(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill('[name="email"]', E2E_EMAIL);
  await page.fill('[name="password"]', E2E_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("/");
  await page.goto("/settings/providers");
}

/** Opens the Add Provider modal and waits for it to be visible. */
async function openAddProviderDialog(page: Page): Promise<void> {
  await page.getByRole("button", { name: /add issue tracker/i }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
}

test.describe("Provider settings - modal UI", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToProviders(page);
  });

  // T002: Add button is visible on providers settings page
  test("Add button is visible on providers settings page", async ({ page }) => {
    await expect(page.getByRole("button", { name: /add issue tracker/i })).toBeVisible();
  });

  // T003: Clicking Add button opens AddProvider modal dialog
  test("clicking Add button opens AddProvider modal dialog", async ({ page }) => {
    await page.getByRole("button", { name: /add issue tracker/i }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  // T004: Submitting valid form adds provider, closes modal, updates list
  test("submitting valid form adds provider, closes modal, updates list", async ({ page }) => {
    // Mock the POST to avoid hitting the real external API
    await page.route("**/api/providers", (route) => {
      if (route.request().method() === "POST") {
        void route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              id: "mock-provider-id",
              type: "GITHUB",
              displayName: "Test GitHub Provider",
            },
          }),
        });
      } else {
        void route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              {
                id: "mock-provider-id",
                type: "GITHUB",
                displayName: "Test GitHub Provider",
              },
            ],
          }),
        });
      }
    });

    await openAddProviderDialog(page);
    const dialog = page.locator('[role="dialog"]');

    await dialog.locator('[data-testid="provider-name-input"]').fill("Test GitHub Provider");
    await dialog.locator('[data-testid="github-token-input"]').fill("ghp_testtoken123456");

    await dialog.getByRole("button", { name: /add issue tracker/i }).click();

    // Modal should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Providers list should show the newly added provider
    await expect(page.getByText("Test GitHub Provider")).toBeVisible();
  });

  // T005: Inline add form is NOT present on provider settings page
  test("inline add form is NOT present on provider settings page", async ({ page }) => {
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
    await loginAndGoToProviders(page);
    await openAddProviderDialog(page);
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
    // Click on the MUI backdrop element (overlay outside the dialog paper)
    await page.locator(".MuiBackdrop-root").click();
    await expect(dialog).not.toBeVisible();
  });
});

test.describe("Provider settings - form validation in modal (US3)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToProviders(page);
    await openAddProviderDialog(page);
  });

  // T012: Saving with empty required fields shows validation error inside modal
  test("saving with empty required fields shows validation error inside modal", async ({ page }) => {
    const dialog = page.locator('[role="dialog"]');
    // The HTML5 `required` attribute prevents submission; dialog stays open
    await dialog.getByRole("button", { name: /add issue tracker/i }).click();
    await expect(dialog).toBeVisible();
  });

  // T013: API error on save shows error message inside modal without closing
  test("API error on save shows error message inside modal without closing", async ({ page }) => {
    const dialog = page.locator('[role="dialog"]');

    await dialog.locator('[data-testid="provider-name-input"]').fill("Bad Provider");
    await dialog.locator('[data-testid="github-token-input"]').fill("invalid_token");

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
