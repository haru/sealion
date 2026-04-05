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

/** Empty API mocks shared across tests. */
const EMPTY_ISSUES = JSON.stringify({ data: { items: [], total: 0 }, error: null });
const EMPTY_PROVIDERS = JSON.stringify({ data: [], error: null });
const DEFAULT_BOARD_SETTINGS = JSON.stringify({
  data: { showCreatedAt: true, showUpdatedAt: false, sortOrder: ["dueDate_asc"] },
  error: null,
});
const SYNCED_PROVIDERS = JSON.stringify({
  data: [{
    id: "p1", displayName: "GitHub", type: "GITHUB",
    projects: [{ id: "proj1", displayName: "my-repo", lastSyncedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), syncError: null }],
  }],
  error: null,
});

test.describe("Global Titlebar — US1: All pages show a unified titlebar", () => {
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

  test("TODO list page shows its title in the titlebar", async ({ page }) => {
    await page.goto("/");
    const header = page.getByTestId("page-header");
    await expect(header).toBeVisible();
    await expect(header).toContainText("My TODO List");
  });

  test("Projects page shows its title in the titlebar", async ({ page }) => {
    await page.goto("/projects");
    const header = page.getByTestId("page-header");
    await expect(header).toBeVisible();
    await expect(header).toContainText("Projects");
  });

  test("Board Settings page shows its title in the titlebar", async ({ page }) => {
    await page.goto("/settings/board");
    const header = page.getByTestId("page-header");
    await expect(header).toBeVisible();
    await expect(header).toContainText("Board Settings");
  });

  test("Providers Settings page shows its title in the titlebar", async ({ page }) => {
    await page.goto("/settings/providers");
    const header = page.getByTestId("page-header");
    await expect(header).toBeVisible();
    await expect(header).toContainText("Issue Tracker Settings");
  });
});

test.describe("Global Titlebar — US2: TODO page shows SyncStatus in titlebar", () => {
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
    await login(page);
  });

  test("TODO list page titlebar shows the Sync Now button", async ({ page }) => {
    await page.goto("/");
    const header = page.getByTestId("page-header");
    await expect(header).toBeVisible();
    await expect(header.getByRole("button", { name: /sync now/i })).toBeVisible();
  });

  test("Projects page titlebar does not show Sync Now button", async ({ page }) => {
    await page.route("**/api/providers**", (route) =>
      route.fulfill({ contentType: "application/json", body: EMPTY_PROVIDERS })
    );
    await page.goto("/projects");
    const header = page.getByTestId("page-header");
    await expect(header).toBeVisible();
    await expect(header.getByRole("button", { name: /sync now/i })).not.toBeVisible();
  });

  test("Board Settings page titlebar does not show Sync Now button", async ({ page }) => {
    await page.goto("/settings/board");
    const header = page.getByTestId("page-header");
    await expect(header).toBeVisible();
    await expect(header.getByRole("button", { name: /sync now/i })).not.toBeVisible();
  });
});

test.describe("Global Titlebar — US3: Extension point renders custom content", () => {
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
    await login(page);
  });

  test("TODO list page right slot contains SyncStatus content", async ({ page }) => {
    await page.goto("/");
    const header = page.getByTestId("page-header");
    const rightSlot = header.getByTestId("page-header-actions");
    await expect(rightSlot).toBeVisible();
    await expect(rightSlot.getByRole("button", { name: /sync now/i })).toBeVisible();
  });

  test("Projects page right slot is empty", async ({ page }) => {
    await page.route("**/api/providers**", (route) =>
      route.fulfill({ contentType: "application/json", body: EMPTY_PROVIDERS })
    );
    await page.goto("/projects");
    const header = page.getByTestId("page-header");
    await expect(header).toBeVisible();
    const rightSlot = header.getByTestId("page-header-actions");
    await expect(rightSlot).not.toBeVisible();
  });

  test("Settings/board page right slot is empty", async ({ page }) => {
    await page.goto("/settings/board");
    const header = page.getByTestId("page-header");
    await expect(header).toBeVisible();
    const rightSlot = header.getByTestId("page-header-actions");
    await expect(rightSlot).not.toBeVisible();
  });

  test("Settings/providers page right slot is empty", async ({ page }) => {
    await page.route("**/api/providers**", (route) =>
      route.fulfill({ contentType: "application/json", body: EMPTY_PROVIDERS })
    );
    await page.goto("/settings/providers");
    const header = page.getByTestId("page-header");
    await expect(header).toBeVisible();
    const rightSlot = header.getByTestId("page-header-actions");
    await expect(rightSlot).not.toBeVisible();
  });
});

test.describe("Global Titlebar — US4: Sync status chip appears next to title", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/issues**", (route) =>
      route.fulfill({ contentType: "application/json", body: EMPTY_ISSUES })
    );
    await page.route("**/api/sync**", (route) =>
      route.fulfill({ contentType: "application/json", body: SYNCED_PROVIDERS })
    );
    await page.route("**/api/board-settings**", (route) =>
      route.fulfill({ contentType: "application/json", body: DEFAULT_BOARD_SETTINGS })
    );
    await login(page);
  });

  test("sync status chip appears in the title area (left side) of the header", async ({ page }) => {
    await page.goto("/");
    const header = page.getByTestId("page-header");
    const titleArea = header.getByTestId("page-header-title");
    await expect(titleArea).toBeVisible();
    await expect(titleArea.getByTestId("sync-status-chip")).toBeVisible();
  });

  test("sync status chip is NOT in the right-slot actions area", async ({ page }) => {
    await page.goto("/");
    const header = page.getByTestId("page-header");
    const rightSlot = header.getByTestId("page-header-actions");
    await expect(rightSlot.getByTestId("sync-status-chip")).not.toBeVisible();
  });
});
