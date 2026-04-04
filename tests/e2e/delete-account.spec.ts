import { test, expect, type Page } from "@playwright/test";

const LOGIN_EMAIL = process.env.E2E_USER_EMAIL ?? "admin@example.com";
const LOGIN_PASSWORD = process.env.E2E_USER_PASSWORD ?? "password123";
const ADMIN2_EMAIL = process.env.E2E_ADMIN2_EMAIL ?? "admin2@example.com";
const ADMIN2_PASSWORD = process.env.E2E_ADMIN2_PASSWORD ?? "password123";

const EMPTY_ISSUES = JSON.stringify({ data: { items: [], total: 0 }, error: null });
const EMPTY_PROVIDERS = JSON.stringify({ data: [], error: null });
const DEFAULT_BOARD_SETTINGS = JSON.stringify({
  data: { showCreatedAt: true, showUpdatedAt: false, sortOrder: ["dueDate_asc"] },
  error: null,
});

/** Logs in via the login form. */
async function login(page: Page, email = LOGIN_EMAIL, password = LOGIN_PASSWORD) {
  await page.goto("http://app:3000/login");
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("http://app:3000/");
}

/** Navigates to the profile settings page after login. */
async function goToProfileSettings(page: Page, email?: string, password?: string) {
  await login(page, email, password);
  await page.goto("http://app:3000/settings/profile");
}

/** Stubs common API routes to avoid network noise. */
async function stubApiRoutes(page: Page) {
  await page.route("**/api/issues**", (route) =>
    route.fulfill({ contentType: "application/json", body: EMPTY_ISSUES })
  );
  await page.route("**/api/sync**", (route) =>
    route.fulfill({ contentType: "application/json", body: EMPTY_PROVIDERS })
  );
  await page.route("**/api/board-settings**", (route) =>
    route.fulfill({ contentType: "application/json", body: DEFAULT_BOARD_SETTINGS })
  );
  await page.route("**/api/providers**", (route) =>
    route.fulfill({ contentType: "application/json", body: EMPTY_PROVIDERS })
  );
}

test.describe("Delete Account — US1: Regular user flow", () => {
  test.beforeEach(async ({ page }) => {
    await stubApiRoutes(page);
  });

  test("Danger Zone section and Delete Account button are visible for a regular user", async ({ page }) => {
    // Stub profile endpoint to return isLastAdmin: false (regular user)
    await page.route("**/api/account/profile**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: { username: null, email: LOGIN_EMAIL, isLastAdmin: false }, error: null }),
      })
    );
    await goToProfileSettings(page);
    await expect(page.getByTestId("danger-zone-section")).toBeVisible();
    await expect(page.getByTestId("delete-account-button")).toBeVisible();
  });

  test("clicking Delete Account opens the confirmation modal", async ({ page }) => {
    await page.route("**/api/account/profile**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: { username: null, email: LOGIN_EMAIL, isLastAdmin: false }, error: null }),
      })
    );
    await goToProfileSettings(page);
    await page.getByTestId("delete-account-button").click();
    await expect(page.getByTestId("delete-account-modal")).toBeVisible();
  });

  test("modal shows email input field", async ({ page }) => {
    await page.route("**/api/account/profile**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: { username: null, email: LOGIN_EMAIL, isLastAdmin: false }, error: null }),
      })
    );
    await goToProfileSettings(page);
    await page.getByTestId("delete-account-button").click();
    await expect(page.getByTestId("delete-account-email-input")).toBeVisible();
  });

  test("Cancel button closes the modal", async ({ page }) => {
    await page.route("**/api/account/profile**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: { username: null, email: LOGIN_EMAIL, isLastAdmin: false }, error: null }),
      })
    );
    await goToProfileSettings(page);
    await page.getByTestId("delete-account-button").click();
    await page.getByTestId("delete-account-cancel-button").click();
    await expect(page.getByTestId("delete-account-modal")).not.toBeVisible();
  });

  test("wrong email shows error message and does not call API", async ({ page }) => {
    await page.route("**/api/account/profile**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: { username: null, email: LOGIN_EMAIL, isLastAdmin: false }, error: null }),
      })
    );
    let deleteApiCalled = false;
    await page.route("**/api/account/me**", (route) => {
      deleteApiCalled = true;
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: null, error: null }) });
    });

    await goToProfileSettings(page);
    await page.getByTestId("delete-account-button").click();
    await page.getByTestId("delete-account-email-input").fill("wrong@email.com");
    await page.getByTestId("delete-account-confirm-button").click();

    await expect(page.getByTestId("delete-account-email-error")).toBeVisible();
    expect(deleteApiCalled).toBe(false);
  });

  test("correct email triggers deletion and redirects to login", async ({ page }) => {
    await page.route("**/api/account/profile**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: { username: null, email: LOGIN_EMAIL, isLastAdmin: false }, error: null }),
      })
    );
    await page.route("**/api/account/me**", (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: null, error: null }) })
    );

    await goToProfileSettings(page);
    await page.getByTestId("delete-account-button").click();
    await page.getByTestId("delete-account-email-input").fill(LOGIN_EMAIL);
    await page.getByTestId("delete-account-confirm-button").click();

    // After deletion, signOut redirects to login
    await page.waitForURL(/\/login/, { timeout: 10000 });
  });

  test("confirm button is disabled while deletion is in progress", async ({ page }) => {
    await page.route("**/api/account/profile**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: { username: null, email: LOGIN_EMAIL, isLastAdmin: false }, error: null }),
      })
    );
    // Slow down the delete response to verify the button is disabled during the request
    await page.route("**/api/account/me**", async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: null, error: null }) });
    });

    await goToProfileSettings(page);
    await page.getByTestId("delete-account-button").click();
    await page.getByTestId("delete-account-email-input").fill(LOGIN_EMAIL);
    await page.getByTestId("delete-account-confirm-button").click();

    // Confirm button should be disabled while the request is in-flight
    await expect(page.getByTestId("delete-account-confirm-button")).toBeDisabled();
  });
});

test.describe("Delete Account — US3: Last admin protection", () => {
  test.beforeEach(async ({ page }) => {
    await stubApiRoutes(page);
  });

  test("sole admin does not see the Delete Account button", async ({ page }) => {
    await page.route("**/api/account/profile**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: { username: null, email: LOGIN_EMAIL, isLastAdmin: true }, error: null }),
      })
    );
    await goToProfileSettings(page);
    await expect(page.getByTestId("delete-account-button")).not.toBeVisible();
  });

  test("admin with multiple admins sees the Delete Account button", async ({ page }) => {
    await page.route("**/api/account/profile**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: { username: null, email: LOGIN_EMAIL, isLastAdmin: false }, error: null }),
      })
    );
    await goToProfileSettings(page);
    await expect(page.getByTestId("delete-account-button")).toBeVisible();
  });
});
