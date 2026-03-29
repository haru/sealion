import { test, expect, type Page } from "@playwright/test";

const LOGIN_EMAIL = process.env.E2E_USER_EMAIL ?? "admin@example.com";
const LOGIN_PASSWORD = process.env.E2E_USER_PASSWORD ?? "password123";

/** Logs in via the login form. */
async function login(page: Page) {
  await page.goto("/login");
  await page.fill('[name="email"]', LOGIN_EMAIL);
  await page.fill('[name="password"]', LOGIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("/");
}

/** Navigates directly to the profile settings page after login. */
async function goToProfileSettings(page: Page) {
  await login(page);
  await page.goto("/settings/profile");
}

const EMPTY_ISSUES = JSON.stringify({ data: { items: [], total: 0 }, error: null });
const EMPTY_PROVIDERS = JSON.stringify({ data: [], error: null });
const DEFAULT_BOARD_SETTINGS = JSON.stringify({
  data: { showCreatedAt: true, showUpdatedAt: false, sortOrder: ["dueDate_asc"] },
  error: null,
});

test.describe("Profile Settings — US3: Page renders password change form", () => {
  test.beforeEach(async ({ page }) => {
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
    await goToProfileSettings(page);
  });

  test("profile settings page renders with all three password fields", async ({ page }) => {
    await expect(page.getByTestId("profile-current-password")).toBeVisible();
    await expect(page.getByTestId("profile-new-password")).toBeVisible();
    await expect(page.getByTestId("profile-confirm-password")).toBeVisible();
  });

  test("profile settings page shows a submit button", async ({ page }) => {
    await expect(page.getByTestId("profile-save-button")).toBeVisible();
  });

  test("profile settings page title appears in the titlebar", async ({ page }) => {
    const header = page.getByTestId("page-header");
    await expect(header).toContainText("Profile Settings");
  });
});

test.describe("Profile Settings — US3: Client-side validation", () => {
  test.beforeEach(async ({ page }) => {
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
    await goToProfileSettings(page);
  });

  test("shows error when confirm password does not match new password", async ({ page }) => {
    // Track whether any API call to PATCH /api/account/password was made
    let apiCalled = false;
    await page.route("**/api/account/password**", (route) => {
      apiCalled = true;
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: null, error: null }) });
    });

    await page.fill('[data-testid="profile-current-password"] input', "currentpassword");
    await page.fill('[data-testid="profile-new-password"] input', "newpassword123");
    await page.fill('[data-testid="profile-confirm-password"] input', "differentpassword");
    await page.click('[data-testid="profile-save-button"]');

    // Error message should appear
    await expect(page.getByTestId("profile-error-message")).toBeVisible();
    // API should NOT have been called
    expect(apiCalled).toBe(false);
  });

  test("shows error when new password is shorter than 8 characters", async ({ page }) => {
    let apiCalled = false;
    await page.route("**/api/account/password**", (route) => {
      apiCalled = true;
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: null, error: null }) });
    });

    await page.fill('[data-testid="profile-current-password"] input', "currentpassword");
    await page.fill('[data-testid="profile-new-password"] input', "short");
    await page.fill('[data-testid="profile-confirm-password"] input', "short");
    await page.click('[data-testid="profile-save-button"]');

    await expect(page.getByTestId("profile-error-message")).toBeVisible();
    expect(apiCalled).toBe(false);
  });
});

test.describe("Profile Settings — US3: API interaction", () => {
  test.beforeEach(async ({ page }) => {
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
    await goToProfileSettings(page);
  });

  test("shows inline success message on successful password change (no redirect)", async ({ page }) => {
    await page.route("**/api/account/password**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: null, error: null }),
      })
    );

    await page.fill('[data-testid="profile-current-password"] input', "currentpassword");
    await page.fill('[data-testid="profile-new-password"] input', "newpassword123");
    await page.fill('[data-testid="profile-confirm-password"] input', "newpassword123");
    await page.click('[data-testid="profile-save-button"]');

    // Success message should appear inline
    await expect(page.getByTestId("profile-success-message")).toBeVisible();
    // Page should NOT have redirected
    expect(page.url()).toContain("/settings/profile");
  });

  test("shows inline error message when server returns wrong current password", async ({ page }) => {
    await page.route("**/api/account/password**", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ data: null, error: "Current password is incorrect." }),
      })
    );

    await page.fill('[data-testid="profile-current-password"] input', "wrongpassword");
    await page.fill('[data-testid="profile-new-password"] input', "newpassword123");
    await page.fill('[data-testid="profile-confirm-password"] input', "newpassword123");
    await page.click('[data-testid="profile-save-button"]');

    await expect(page.getByTestId("profile-error-message")).toBeVisible();
  });
});
