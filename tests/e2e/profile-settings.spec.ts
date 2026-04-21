import { test, expect, type Page } from "@playwright/test";

const LOGIN_EMAIL = process.env.E2E_USER_EMAIL ?? "admin@example.com";
const LOGIN_PASSWORD = process.env.E2E_USER_PASSWORD ?? "password123";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('[name="email"]', LOGIN_EMAIL);
  await page.fill('[name="password"]', LOGIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("/");
}

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
const DEFAULT_PROFILE = JSON.stringify({
  data: { username: "testuser", email: "admin@example.com", isLastAdmin: false, useGravatar: false },
  error: null,
});

function stubCommonRoutes(page: Page) {
  return Promise.all([
    page.route("**/api/issues**", (route) =>
      route.fulfill({ contentType: "application/json", body: EMPTY_ISSUES })
    ),
    page.route("**/api/sync**", (route) =>
      route.fulfill({ contentType: "application/json", body: EMPTY_PROVIDERS })
    ),
    page.route("**/api/board-settings**", (route) =>
      route.fulfill({ contentType: "application/json", body: DEFAULT_BOARD_SETTINGS })
    ),
    page.route("**/api/providers**", (route) =>
      route.fulfill({ contentType: "application/json", body: EMPTY_PROVIDERS })
    ),
    page.route("**/api/account/profile**", (route) =>
      route.fulfill({ contentType: "application/json", body: DEFAULT_PROFILE })
    ),
  ]);
}

async function waitForFormReady(page: Page) {
  await expect(page.getByTestId("profile-save-button")).toBeEnabled();
}

// ---------------------------------------------------------------------------
// Page renders
// ---------------------------------------------------------------------------

test.describe("Profile Settings — page renders", () => {
  test.beforeEach(async ({ page }) => {
    await stubCommonRoutes(page);
    await goToProfileSettings(page);
  });

  test("username field is visible", async ({ page }) => {
    await expect(page.getByTestId("profile-username")).toBeVisible();
  });

  test("Gravatar toggle is visible", async ({ page }) => {
    await expect(page.getByTestId("profile-gravatar-toggle")).toBeVisible();
  });

  test("Change Password checkbox is visible", async ({ page }) => {
    await expect(page.getByTestId("profile-change-password-checkbox")).toBeVisible();
  });

  test("password fields are hidden by default", async ({ page }) => {
    await expect(page.getByTestId("profile-current-password")).not.toBeVisible();
    await expect(page.getByTestId("profile-new-password")).not.toBeVisible();
    await expect(page.getByTestId("profile-confirm-password")).not.toBeVisible();
  });

  test("single Save Settings button is visible", async ({ page }) => {
    await expect(page.getByTestId("profile-save-button")).toBeVisible();
  });

  test("page title appears in the titlebar", async ({ page }) => {
    const header = page.getByTestId("page-header");
    await expect(header).toContainText("Profile Settings");
  });
});

// ---------------------------------------------------------------------------
// Change Password checkbox flow (US2)
// ---------------------------------------------------------------------------

test.describe("Profile Settings — Change Password checkbox flow", () => {
  test.beforeEach(async ({ page }) => {
    await stubCommonRoutes(page);
    await goToProfileSettings(page);
  });

  test("checking Change Password reveals the three password fields", async ({ page }) => {
    await waitForFormReady(page);
    await page.click('[data-testid="profile-change-password-checkbox"]');
    await expect(page.getByTestId("profile-current-password")).toBeVisible();
    await expect(page.getByTestId("profile-new-password")).toBeVisible();
    await expect(page.getByTestId("profile-confirm-password")).toBeVisible();
  });

  test("unchecking Change Password hides and clears password fields", async ({ page }) => {
    await waitForFormReady(page);
    // Show fields and type values
    await page.click('[data-testid="profile-change-password-checkbox"]');
    await page.fill('[data-testid="profile-current-password"] input', "somepassword");
    // Uncheck — fields should disappear
    await page.click('[data-testid="profile-change-password-checkbox"]');
    await expect(page.getByTestId("profile-current-password")).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Client-side validation (US2/US3)
// ---------------------------------------------------------------------------

test.describe("Profile Settings — client-side validation", () => {
  test.beforeEach(async ({ page }) => {
    await stubCommonRoutes(page);
    await goToProfileSettings(page);
  });

  test("shows error when confirm password does not match", async ({ page }) => {
    let apiCalled = false;
    await page.route("**/api/account/settings**", (route) => {
      apiCalled = true;
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: null, error: null }) });
    });

    await waitForFormReady(page);
    await page.click('[data-testid="profile-change-password-checkbox"]');
    await page.fill('[data-testid="profile-current-password"] input', "currentpassword");
    await page.fill('[data-testid="profile-new-password"] input', "newpassword123");
    await page.fill('[data-testid="profile-confirm-password"] input', "differentpassword");
    await page.click('[data-testid="profile-save-button"]');

    await expect(page.getByTestId("profile-save-error")).toBeVisible();
    expect(apiCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unified save (US1+US3)
// ---------------------------------------------------------------------------

test.describe("Profile Settings — unified save", () => {
  test.beforeEach(async ({ page }) => {
    await stubCommonRoutes(page);
    await goToProfileSettings(page);
  });

  test("shows success message after saving settings without password change", async ({ page }) => {
    await page.route("**/api/account/settings**", (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: null, error: null }) })
    );

    await waitForFormReady(page);
    await page.fill('[data-testid="profile-username"] input', "newusername");
    await page.click('[data-testid="profile-save-button"]');

    await expect(page.getByTestId("profile-save-success")).toBeVisible();
    expect(page.url()).toContain("/settings/profile");
  });

  test("shows success message after saving with password change", async ({ page }) => {
    await page.route("**/api/account/settings**", (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: null, error: null }) })
    );

    await waitForFormReady(page);
    await page.click('[data-testid="profile-change-password-checkbox"]');
    await page.fill('[data-testid="profile-current-password"] input', "currentpassword");
    await page.fill('[data-testid="profile-new-password"] input', "newpassword123");
    await page.fill('[data-testid="profile-confirm-password"] input', "newpassword123");
    await page.click('[data-testid="profile-save-button"]');

    await expect(page.getByTestId("profile-save-success")).toBeVisible();
  });

  test("password fields are sent in request when changePassword is checked", async ({ page }) => {
    const requestPromise = page.waitForRequest("**/api/account/settings**");

    await page.route("**/api/account/settings**", (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: null, error: null }) })
    );

    await waitForFormReady(page);
    await page.click('[data-testid="profile-change-password-checkbox"]');
    await page.fill('[data-testid="profile-current-password"] input', "currentpassword");
    await page.fill('[data-testid="profile-new-password"] input', "newpassword123");
    await page.fill('[data-testid="profile-confirm-password"] input', "newpassword123");
    await page.click('[data-testid="profile-save-button"]');

    const request = await requestPromise;
    const parsed = JSON.parse(request.postData() ?? "{}");
    expect(parsed.changePassword).toBe(true);
    expect(parsed.currentPassword).toBe("currentpassword");
    expect(parsed.newPassword).toBe("newpassword123");
    expect(parsed.confirmPassword).toBeUndefined();
  });

  test("shows inline error when server returns PASSWORD_INCORRECT", async ({ page }) => {
    await page.route("**/api/account/settings**", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ data: null, error: "PASSWORD_INCORRECT" }),
      })
    );

    await waitForFormReady(page);
    await page.click('[data-testid="profile-change-password-checkbox"]');
    await page.fill('[data-testid="profile-current-password"] input', "wrongpassword");
    await page.fill('[data-testid="profile-new-password"] input', "newpassword123");
    await page.fill('[data-testid="profile-confirm-password"] input', "newpassword123");
    await page.click('[data-testid="profile-save-button"]');

    await expect(page.getByTestId("profile-save-error")).toBeVisible();
  });

  test("shows inline error when server returns USERNAME_TOO_LONG", async ({ page }) => {
    await page.route("**/api/account/settings**", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ data: null, error: "USERNAME_TOO_LONG" }),
      })
    );

    await waitForFormReady(page);
    await page.fill('[data-testid="profile-username"] input', "a".repeat(51));
    await page.click('[data-testid="profile-save-button"]');

    await expect(page.getByTestId("profile-save-error")).toBeVisible();
  });
});
