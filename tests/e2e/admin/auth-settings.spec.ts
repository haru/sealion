import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "password123";
const USER_EMAIL = process.env.E2E_USER_EMAIL ?? "user@example.com";
const USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? "password123";

test.describe("Auth Settings — US1: Access Control", () => {
  test("admin can navigate to auth settings via sidebar", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', ADMIN_EMAIL);
    await page.fill('[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    const sidebar = page.getByTestId("sidebar");
    await sidebar.getByText(/system administration|システム管理/i).click();
    await sidebar.getByText(/auth settings|認証設定/i).click();
    await page.waitForURL(/admin\/auth-settings/);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/admin/auth-settings");
    await page.waitForURL(/login/);
    await expect(page).toHaveURL(/login/);
  });

  test("non-admin gets 403 on direct URL access", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/login");
    await page.fill('[name="email"]', USER_EMAIL);
    await page.fill('[name="password"]', USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    await page.goto("/admin/auth-settings");
    await page.waitForTimeout(1000);

    const body = await page.locator("body").textContent();
    const isBlocked =
      (body?.toLowerCase().includes("forbidden") ?? false) ||
      (body?.toLowerCase().includes("403") ?? false) ||
      !page.url().includes("admin/auth-settings");

    expect(isBlocked).toBeTruthy();
    await context.close();
  });
});

test.describe("Auth Settings — US2: allowUserSignup toggle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', ADMIN_EMAIL);
    await page.fill('[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
    await page.goto("/admin/auth-settings");
    await page.waitForURL(/admin\/auth-settings/);
  });

  test("page renders allowUserSignup Switch", async ({ page }) => {
    await expect(page.getByRole("checkbox", { name: /allow user signup|ユーザーによるアカウント追加/i })).toBeVisible();
  });

  test("admin can toggle allowUserSignup and save (SC-001)", async ({ page }) => {
    const toggle = page.getByRole("checkbox", { name: /allow user signup|ユーザーによるアカウント追加/i });
    const currentState = await toggle.isChecked();
    await toggle.click();
    await page.getByRole("button", { name: /save|保存/i }).click();

    // Success notification should appear
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 3000 });

    // Reload and verify state persists
    await page.reload();
    await page.waitForURL(/admin\/auth-settings/);
    const newState = await page.getByRole("checkbox", { name: /allow user signup|ユーザーによるアカウント追加/i }).isChecked();
    expect(newState).toBe(!currentState);

    // Restore original state
    await page.getByRole("checkbox", { name: /allow user signup|ユーザーによるアカウント追加/i }).click();
    await page.getByRole("button", { name: /save|保存/i }).click();
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 3000 });
  });

  test("signup link hidden when allowUserSignup disabled (SC-002)", async ({ page }) => {
    // Disable signup
    const toggle = page.getByRole("checkbox", { name: /allow user signup|ユーザーによるアカウント追加/i });
    if (await toggle.isChecked()) {
      await toggle.click();
      await page.getByRole("button", { name: /save|保存/i }).click();
      await expect(page.getByRole("alert")).toBeVisible({ timeout: 3000 });
    }

    // Check login page for signup link
    await page.goto("/login");
    await page.waitForTimeout(500);
    const signupLink = page.getByRole("link", { name: /sign up|サインアップ/i });
    await expect(signupLink).not.toBeVisible();

    // Re-enable signup
    await page.goto("/admin/auth-settings");
    await page.waitForURL(/admin\/auth-settings/);
    const toggleAgain = page.getByRole("checkbox", { name: /allow user signup|ユーザーによるアカウント追加/i });
    if (!(await toggleAgain.isChecked())) {
      await toggleAgain.click();
      await page.getByRole("button", { name: /save|保存/i }).click();
      await expect(page.getByRole("alert")).toBeVisible({ timeout: 3000 });
    }
  });
});

test.describe("Auth Settings — US4: requireEmailVerification toggle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', ADMIN_EMAIL);
    await page.fill('[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
    await page.goto("/admin/auth-settings");
    await page.waitForURL(/admin\/auth-settings/);
  });

  test("requireEmailVerification toggle is visible when allowUserSignup is enabled", async ({ page }) => {
    const signupToggle = page.getByRole("checkbox", { name: /allow user signup|ユーザーによるアカウント追加/i });
    if (!(await signupToggle.isChecked())) {
      await signupToggle.click();
      await page.getByRole("button", { name: /save|保存/i }).click();
      await expect(page.getByRole("alert")).toBeVisible({ timeout: 3000 });
      await page.reload();
      await page.waitForURL(/admin\/auth-settings/);
    }

    const emailVerifyToggle = page.getByRole("checkbox", {
      name: /require email verification|メール確認/i,
    });
    await expect(emailVerifyToggle).toBeVisible();
  });

  test("requireEmailVerification toggle is hidden when allowUserSignup is disabled", async ({ page }) => {
    const signupToggle = page.getByRole("checkbox", { name: /allow user signup|ユーザーによるアカウント追加/i });
    if (await signupToggle.isChecked()) {
      await signupToggle.click();
      await page.getByRole("button", { name: /save|保存/i }).click();
      await expect(page.getByRole("alert")).toBeVisible({ timeout: 3000 });
      await page.reload();
      await page.waitForURL(/admin\/auth-settings/);
    }

    const emailVerifyToggle = page.getByRole("checkbox", {
      name: /require email verification|メール確認/i,
    });
    await expect(emailVerifyToggle).not.toBeVisible();

    // Restore allowUserSignup
    await page.getByRole("checkbox", { name: /allow user signup|ユーザーによるアカウント追加/i }).click();
    await page.getByRole("button", { name: /save|保存/i }).click();
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 3000 });
  });

  test("admin can toggle requireEmailVerification on and off", async ({ page }) => {
    // Ensure allowUserSignup is on first
    const signupToggle = page.getByRole("checkbox", { name: /allow user signup|ユーザーによるアカウント追加/i });
    if (!(await signupToggle.isChecked())) {
      await signupToggle.click();
      await page.getByRole("button", { name: /save|保存/i }).click();
      await expect(page.getByRole("alert")).toBeVisible({ timeout: 3000 });
      await page.reload();
      await page.waitForURL(/admin\/auth-settings/);
    }

    const emailVerifyToggle = page.getByRole("checkbox", {
      name: /require email verification|メール確認/i,
    });
    const initialState = await emailVerifyToggle.isChecked();
    await emailVerifyToggle.click();
    await page.getByRole("button", { name: /save|保存/i }).click();
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 3000 });

    // Verify persists after reload
    await page.reload();
    await page.waitForURL(/admin\/auth-settings/);
    const afterToggle = page.getByRole("checkbox", {
      name: /require email verification|メール確認/i,
    });
    expect(await afterToggle.isChecked()).toBe(!initialState);

    // Restore original state
    await afterToggle.click();
    await page.getByRole("button", { name: /save|保存/i }).click();
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 3000 });
  });
});

test.describe("Auth Settings — US3: Session timeout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', ADMIN_EMAIL);
    await page.fill('[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
    await page.goto("/admin/auth-settings");
    await page.waitForURL(/admin\/auth-settings/);
  });

  test("page renders session timeout Select with 8 options", async ({ page }) => {
    const select = page.getByRole("combobox", { name: /session timeout|セッションタイムアウト/i });
    await expect(select).toBeVisible();
    await select.click();
    // Should have 8 options
    const options = page.getByRole("option");
    await expect(options).toHaveCount(8);
  });

  test("admin can select 1 hour timeout and save (SC-004)", async ({ page }) => {
    const select = page.getByRole("combobox", { name: /session timeout|セッションタイムアウト/i });
    await select.click();
    await page.getByRole("option", { name: /1 hour|1時間/i }).click();
    await page.getByRole("button", { name: /save|保存/i }).click();
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 3000 });

    // Reload and verify setting persists (SC-004: immediately reflected)
    await page.reload();
    await page.waitForURL(/admin\/auth-settings/);
    const selectAfter = page.getByRole("combobox", { name: /session timeout|セッションタイムアウト/i });
    await expect(selectAfter).toHaveText(/1 hour|1時間/i);

    // Restore to None
    await selectAfter.click();
    await page.getByRole("option", { name: /^none$|^なし$/i }).click();
    await page.getByRole("button", { name: /save|保存/i }).click();
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 3000 });
  });
});
