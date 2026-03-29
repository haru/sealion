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

/** Mocks shared across tests. */
const EMPTY_ISSUES = JSON.stringify({ data: { items: [], total: 0 }, error: null });
const EMPTY_PROVIDERS = JSON.stringify({ data: [], error: null });
const DEFAULT_BOARD_SETTINGS = JSON.stringify({
  data: { showCreatedAt: true, showUpdatedAt: false, sortOrder: ["dueDate_asc"] },
  error: null,
});

test.describe("Account Menu — US1: Account icon appears in titlebar", () => {
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
    await login(page);
  });

  test("account icon is visible in the titlebar on the dashboard page", async ({ page }) => {
    await page.goto("/");
    const header = page.getByTestId("page-header");
    await expect(header).toBeVisible();
    const accountButton = header.getByTestId("account-menu-button");
    await expect(accountButton).toBeVisible();
  });

  test("account icon is visible in the titlebar on the projects page", async ({ page }) => {
    await page.goto("/projects");
    const header = page.getByTestId("page-header");
    const accountButton = header.getByTestId("account-menu-button");
    await expect(accountButton).toBeVisible();
  });

  test("account icon shows user initials derived from email", async ({ page }) => {
    await page.goto("/");
    const header = page.getByTestId("page-header");
    const accountButton = header.getByTestId("account-menu-button");
    // Email is admin@example.com so initial is "A"
    await expect(accountButton).toContainText("A");
  });
});

test.describe("Account Menu — US1: Dropdown opens and shows 4 items", () => {
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
    await login(page);
  });

  test("clicking account icon opens dropdown with email, profile settings, issue settings, and logout", async ({
    page,
  }) => {
    await page.goto("/");
    const header = page.getByTestId("page-header");
    await header.getByTestId("account-menu-button").click();

    const menu = page.getByTestId("account-menu-dropdown");
    await expect(menu).toBeVisible();

    // Email display (non-clickable)
    await expect(menu.getByTestId("account-menu-email")).toBeVisible();
    await expect(menu.getByTestId("account-menu-email")).toContainText(LOGIN_EMAIL);

    // Profile Settings link
    await expect(menu.getByTestId("account-menu-profile")).toBeVisible();

    // Issue Management Settings link
    await expect(menu.getByTestId("account-menu-issue-settings")).toBeVisible();

    // Log Out button
    await expect(menu.getByTestId("account-menu-logout")).toBeVisible();
  });

  test("clicking outside the dropdown closes it", async ({ page }) => {
    await page.goto("/");
    const header = page.getByTestId("page-header");
    await header.getByTestId("account-menu-button").click();

    const menu = page.getByTestId("account-menu-dropdown");
    await expect(menu).toBeVisible();

    // Click outside the menu
    await page.mouse.click(10, 10);
    await expect(menu).not.toBeVisible();
  });
});

test.describe("Account Menu — US2: No account items in sidebar", () => {
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
    await login(page);
  });

  test("sidebar does not contain an account avatar or email display", async ({ page }) => {
    await page.goto("/");
    const sidebar = page.getByTestId("sidebar");
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByTestId("sidebar-profile-footer")).not.toBeVisible();
  });
});

test.describe("Account Menu — US4: Issue settings navigation", () => {
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
    await login(page);
  });

  test("clicking Issue Management Settings navigates to /settings/providers", async ({ page }) => {
    await page.goto("/");
    const header = page.getByTestId("page-header");
    await header.getByTestId("account-menu-button").click();

    const menu = page.getByTestId("account-menu-dropdown");
    await menu.getByTestId("account-menu-issue-settings").click();
    await page.waitForURL("**/settings/providers");
    expect(page.url()).toContain("/settings/providers");
  });

  test("clicking Profile Settings navigates to /settings/profile", async ({ page }) => {
    await page.goto("/");
    const header = page.getByTestId("page-header");
    await header.getByTestId("account-menu-button").click();

    const menu = page.getByTestId("account-menu-dropdown");
    await menu.getByTestId("account-menu-profile").click();
    await page.waitForURL("**/settings/profile");
    expect(page.url()).toContain("/settings/profile");
  });
});

test.describe("Account Menu — US5: Logout", () => {
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
    await login(page);
  });

  test("clicking Log Out redirects to login page", async ({ page }) => {
    await page.goto("/");
    const header = page.getByTestId("page-header");
    await header.getByTestId("account-menu-button").click();

    const menu = page.getByTestId("account-menu-dropdown");
    await menu.getByTestId("account-menu-logout").click();
    await page.waitForURL("**/login");
    expect(page.url()).toContain("/login");
  });

  test("after logout, navigating back to dashboard redirects to login", async ({ page }) => {
    await page.goto("/");
    const header = page.getByTestId("page-header");
    await header.getByTestId("account-menu-button").click();

    const menu = page.getByTestId("account-menu-dropdown");
    await menu.getByTestId("account-menu-logout").click();
    await page.waitForURL("**/login");

    await page.goto("/");
    await page.waitForURL("**/login");
    expect(page.url()).toContain("/login");
  });
});
