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

/** Default board settings API response. */
const DEFAULT_BOARD_SETTINGS = JSON.stringify({
  data: {
    showCreatedAt: true,
    showUpdatedAt: false,
    sortOrder: ["dueDate_asc", "providerUpdatedAt_desc"],
  },
  error: null,
});

/** Empty issues mock. */
const EMPTY_ISSUES = JSON.stringify({ data: { items: [], total: 0 }, error: null });

/** Empty providers mock. */
const EMPTY_PROVIDERS = JSON.stringify({ data: [], error: null });

test.describe("Board Settings — Navigation (US1)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/board-settings", (route) => {
      route.fulfill({ contentType: "application/json", body: DEFAULT_BOARD_SETTINGS });
    });
    await page.route("**/api/issues**", (route) => {
      route.fulfill({ contentType: "application/json", body: EMPTY_ISSUES });
    });
    await page.route("**/api/sync**", (route) => {
      route.fulfill({ contentType: "application/json", body: EMPTY_PROVIDERS });
    });
    await login(page);
  });

  test("sidebar shows Board Settings link under Project Management section", async ({ page }) => {
    await expect(page.getByRole("link", { name: /board settings/i })).toBeVisible();
  });

  test("clicking Board Settings link navigates to /settings/board", async ({ page }) => {
    await page.getByRole("link", { name: /board settings/i }).click();
    await page.waitForURL("**/settings/board");
    expect(page.url()).toContain("/settings/board");
  });

  test("board settings page shows Display Items section and Sort Order section", async ({ page }) => {
    await page.goto("/settings/board");
    await expect(page.getByText(/display items/i)).toBeVisible();
    await expect(page.getByText(/sort order/i)).toBeVisible();
  });
});

test.describe("Board Settings — Display Items (US2)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/board-settings", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({ contentType: "application/json", body: DEFAULT_BOARD_SETTINGS });
      } else {
        route.fulfill({ contentType: "application/json", body: DEFAULT_BOARD_SETTINGS });
      }
    });
    await page.route("**/api/issues**", (route) => {
      route.fulfill({ contentType: "application/json", body: EMPTY_ISSUES });
    });
    await page.route("**/api/sync**", (route) => {
      route.fulfill({ contentType: "application/json", body: EMPTY_PROVIDERS });
    });
    await login(page);
  });

  test("default state shows only Created At checked", async ({ page }) => {
    await page.goto("/settings/board");
    const showCreatedAtCheckbox = page.getByLabel(/show created at/i);
    const showUpdatedAtCheckbox = page.getByLabel(/show updated at/i);
    await expect(showCreatedAtCheckbox).toBeChecked();
    await expect(showUpdatedAtCheckbox).not.toBeChecked();
  });

  test("can check Updated At, save, and settings are preserved on reload", async ({ page }) => {
    let savedSettings = {
      showCreatedAt: true,
      showUpdatedAt: false,
      sortOrder: ["dueDate_asc", "providerUpdatedAt_desc"],
    };

    await page.route("**/api/board-settings", async (route) => {
      if (route.request().method() === "PUT") {
        const body = JSON.parse(route.request().postData() ?? "{}");
        savedSettings = body;
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ data: savedSettings, error: null }),
        });
      } else {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ data: savedSettings, error: null }),
        });
      }
    });

    await page.goto("/settings/board");
    await page.getByLabel(/show updated at/i).click();
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText(/saved successfully/i)).toBeVisible();

    // Reload and verify persistence
    await page.reload();
    await expect(page.getByLabel(/show updated at/i)).toBeChecked();
  });
});

test.describe("Board Settings — Sort Order (US3)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/board-settings", (route) => {
      route.fulfill({ contentType: "application/json", body: DEFAULT_BOARD_SETTINGS });
    });
    await page.route("**/api/issues**", (route) => {
      route.fulfill({ contentType: "application/json", body: EMPTY_ISSUES });
    });
    await page.route("**/api/sync**", (route) => {
      route.fulfill({ contentType: "application/json", body: EMPTY_PROVIDERS });
    });
    await login(page);
  });

  test("default active sort order shows Due Date at rank 1 and Updated At at rank 2", async ({ page }) => {
    await page.goto("/settings/board");
    const activeItems = page.locator("[data-testid='sort-active-item']");
    await expect(activeItems.nth(0)).toContainText(/due date/i);
    await expect(activeItems.nth(1)).toContainText(/updated at/i);
  });

  test("default available panel shows Created At", async ({ page }) => {
    await page.goto("/settings/board");
    const availableItems = page.locator("[data-testid='sort-available-item']");
    await expect(availableItems).toHaveCount(1);
    await expect(availableItems.first()).toContainText(/created at/i);
  });

  test("can add item from available to active by selecting then clicking add button", async ({ page }) => {
    await page.goto("/settings/board");
    // Select the item in the available list, then click →
    await page.locator("[data-testid='sort-available-item']").first().click();
    await page.locator("[data-testid='sort-add-btn']").click();
    const activeItems = page.locator("[data-testid='sort-active-item']");
    await expect(activeItems).toHaveCount(3);
    const availableItems = page.locator("[data-testid='sort-available-item']");
    await expect(availableItems).toHaveCount(0);
  });

  test("can remove item from active to available by selecting then clicking remove button", async ({ page }) => {
    await page.goto("/settings/board");
    // Select "Due Date" in the active list, then click ←
    await page.locator("[data-testid='sort-active-item']").first().click();
    await page.locator("[data-testid='sort-remove-btn']").click();
    const activeItems = page.locator("[data-testid='sort-active-item']");
    await expect(activeItems).toHaveCount(1);
    const availableItems = page.locator("[data-testid='sort-available-item']");
    await expect(availableItems).toHaveCount(2);
  });

  test("can reorder active items with move-up button", async ({ page }) => {
    await page.goto("/settings/board");
    const activeItems = page.locator("[data-testid='sort-active-item']");
    await expect(activeItems.nth(0)).toContainText(/due date/i);
    // Select "Updated At" (index 1), then click ↑
    await activeItems.nth(1).click();
    await page.locator("[data-testid='sort-move-up']").click();
    await expect(activeItems.nth(0)).toContainText(/updated at/i);
    await expect(activeItems.nth(1)).toContainText(/due date/i);
  });

  test("sort order is preserved on reload", async ({ page }) => {
    let savedSettings = {
      showCreatedAt: true,
      showUpdatedAt: false,
      sortOrder: ["providerUpdatedAt_desc", "dueDate_asc"],
    };

    await page.route("**/api/board-settings", async (route) => {
      if (route.request().method() === "PUT") {
        const body = JSON.parse(route.request().postData() ?? "{}");
        savedSettings = body;
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ data: savedSettings, error: null }),
        });
      } else {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ data: savedSettings, error: null }),
        });
      }
    });

    await page.goto("/settings/board");
    // After reload, the order should reflect the saved state (Updated At first)
    const activeItems = page.locator("[data-testid='sort-active-item']");
    await expect(activeItems.nth(0)).toContainText(/updated at/i);
    await expect(activeItems.nth(1)).toContainText(/due date/i);
  });
});
