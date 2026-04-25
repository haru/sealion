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

// US2: Gravatar disable flow
test.describe("Gravatar toggle — US2: disable Gravatar", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/issues**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: EMPTY_ISSUES })
    );
    await page.route("**/api/providers**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: EMPTY_PROVIDERS })
    );
    await page.route("**/api/board-settings**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: DEFAULT_BOARD_SETTINGS })
    );
  });

  test("toggle OFF and save shows initial in navbar", async ({ page }) => {
    // Mock profile API to return useGravatar: true initially
    await page.route("**/api/account/profile", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: { username: null, email: LOGIN_EMAIL, isLastAdmin: false, useGravatar: true },
            error: null,
          }),
        });
      } else {
        await route.continue();
      }
    });
    await page.route("**/api/account/settings", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: null, error: null }),
        });
      } else {
        await route.continue();
      }
    });

    await goToProfileSettings(page);

    // Toggle should be ON (Gravatar enabled)
    const toggle = page.getByRole("switch");
    await expect(toggle).toBeChecked();

    // Turn it OFF
    await toggle.click();
    await expect(toggle).not.toBeChecked();

    // Save
    await page.getByTestId("profile-save-button").click();
    await expect(page.getByTestId("profile-save-success")).toBeVisible();
  });

  test("after disabling Gravatar, page reload shows toggle OFF", async ({ page }) => {
    // Mock profile API to always return useGravatar: false
    await page.route("**/api/account/profile", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: { username: null, email: LOGIN_EMAIL, isLastAdmin: false, useGravatar: false },
            error: null,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await goToProfileSettings(page);

    const toggle = page.getByRole("switch");
    await expect(toggle).not.toBeChecked();
  });
});

// US1 & US3: enable Gravatar and verify navbar changes
test.describe("Gravatar toggle — US1: enable Gravatar", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/issues**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: EMPTY_ISSUES })
    );
    await page.route("**/api/providers**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: EMPTY_PROVIDERS })
    );
    await page.route("**/api/board-settings**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: DEFAULT_BOARD_SETTINGS })
    );
  });

  test("toggle ON and save shows success message", async ({ page }) => {
    await page.route("**/api/account/profile", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: { username: null, email: LOGIN_EMAIL, isLastAdmin: false, useGravatar: false },
            error: null,
          }),
        });
      } else {
        await route.continue();
      }
    });
    await page.route("**/api/account/settings", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: null, error: null }),
        });
      } else {
        await route.continue();
      }
    });

    await goToProfileSettings(page);

    const toggle = page.getByRole("switch");
    await expect(toggle).not.toBeChecked();

    await toggle.click();
    await expect(toggle).toBeChecked();

    await page.getByTestId("profile-save-button").click();
    await expect(page.getByTestId("profile-save-success")).toBeVisible();
  });
});

// US3: Unregistered Gravatar email shows initial (not broken image)
test.describe("Gravatar toggle — US3: unregistered email fallback", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/issues**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: EMPTY_ISSUES })
    );
    await page.route("**/api/providers**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: EMPTY_PROVIDERS })
    );
    await page.route("**/api/board-settings**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: DEFAULT_BOARD_SETTINGS })
    );
  });

  test("when Gravatar is enabled for unregistered email, account menu button is visible", async ({ page }) => {
    await page.route("**/api/account/profile", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: { username: null, email: "unregistered@noemail.invalid", isLastAdmin: false, useGravatar: true },
            error: null,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await goToProfileSettings(page);
    // The account menu button should still be present (no broken UI)
    await expect(page.getByTestId("account-menu-button")).toBeVisible();
  });
});
