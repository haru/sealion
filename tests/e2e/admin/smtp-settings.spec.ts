import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "password123";
const USER_EMAIL = process.env.E2E_USER_EMAIL ?? "user@example.com";
const USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? "password123";

test.describe("SMTP Settings — Access Control", () => {
  test("admin can navigate to smtp settings via sidebar", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', ADMIN_EMAIL);
    await page.fill('[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    const sidebar = page.getByTestId("sidebar");
    await sidebar.getByText(/system administration|システム管理/i).click();
    await sidebar.getByText(/email settings|メール送信設定/i).click();
    await page.waitForURL(/admin\/smtp-settings/);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/admin/smtp-settings");
    await page.waitForURL(/login/);
    await expect(page).toHaveURL(/login/);
  });

  test("non-admin gets blocked on direct URL access", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/login");
    await page.fill('[name="email"]', USER_EMAIL);
    await page.fill('[name="password"]', USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    await page.goto("/admin/smtp-settings");
    await page.waitForTimeout(1000);

    const body = await page.locator("body").textContent();
    const isBlocked =
      (body?.toLowerCase().includes("forbidden") ?? false) ||
      (body?.toLowerCase().includes("403") ?? false) ||
      !page.url().includes("admin/smtp-settings");

    expect(isBlocked).toBeTruthy();
    await context.close();
  });
});

test.describe("SMTP Settings — US1: Save Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', ADMIN_EMAIL);
    await page.fill('[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
    await page.goto("/admin/smtp-settings");
    await expect(page.locator("form, .MuiPaper-root")).toBeVisible();
  });

  test("page shows all required fields with defaults", async ({ page }) => {
    await expect(page.getByLabel(/smtp host|SMTPホスト/i)).toBeVisible();
    await expect(page.getByLabel(/port|ポート/i)).toBeVisible();
    await expect(page.getByLabel(/from address|送信元アドレス/i)).toBeVisible();
    await expect(page.getByLabel(/from name|送信者名/i)).toBeVisible();
    await expect(page.getByLabel(/use tls|TLSを使用/i)).toBeVisible();
    await expect(page.getByLabel(/require auth|要認証/i)).toBeVisible();
  });

  test("auth fields are hidden when requireAuth is unchecked", async ({ page }) => {
    const requireAuthSwitch = page.getByLabel(/require auth|要認証/i);
    const isChecked = await requireAuthSwitch.isChecked();

    if (isChecked) {
      await requireAuthSwitch.click();
    }

    await expect(page.getByLabel(/^username|^ユーザー名/i)).not.toBeVisible();
    await expect(page.getByLabel(/^password|^パスワード/i)).not.toBeVisible();
  });

  test("auth fields appear when requireAuth is checked", async ({ page }) => {
    const requireAuthSwitch = page.getByLabel(/require auth|要認証/i);
    const isChecked = await requireAuthSwitch.isChecked();

    if (!isChecked) {
      await requireAuthSwitch.click();
    }

    await expect(page.getByLabel(/^username|^ユーザー名/i)).toBeVisible();
    await expect(page.getByLabel(/^password|^パスワード/i)).toBeVisible();
  });

  test("save settings persists on page reload", async ({ page }) => {
    await page.getByLabel(/smtp host|SMTPホスト/i).fill("smtp.test-persist.com");
    await page.getByLabel(/port|ポート/i).fill("465");
    await page.getByLabel(/from address|送信元アドレス/i).fill("test@persist.com");
    await page.getByLabel(/from name|送信者名/i).fill("TestPersist");

    await page.getByRole("button", { name: /^save$|^保存$/i }).click();

    await expect(page.getByText(/saved successfully|保存しました/i)).toBeVisible({ timeout: 5000 });

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.getByLabel(/smtp host|SMTPホスト/i)).toHaveValue("smtp.test-persist.com");
    await expect(page.getByLabel(/port|ポート/i)).toHaveValue("465");
    await expect(page.getByLabel(/from address|送信元アドレス/i)).toHaveValue("test@persist.com");
    await expect(page.getByLabel(/from name|送信者名/i)).toHaveValue("TestPersist");
  });

  test("password field shows masked value when hasPassword is true after save", async ({ page }) => {
    const requireAuthSwitch = page.getByLabel(/require auth|要認証/i);
    if (!(await requireAuthSwitch.isChecked())) {
      await requireAuthSwitch.click();
    }

    await page.getByLabel(/smtp host|SMTPホスト/i).fill("smtp.masked.com");
    await page.getByLabel(/from address|送信元アドレス/i).fill("masked@example.com");
    await page.getByLabel(/from name|送信者名/i).fill("Masked");
    await page.getByLabel(/^username|^ユーザー名/i).fill("user@masked.com");
    await page.getByLabel(/^password|^パスワード/i).fill("mysecret");

    await page.getByRole("button", { name: /^save$|^保存$/i }).click();
    await expect(page.getByText(/saved successfully|保存しました/i)).toBeVisible({ timeout: 5000 });

    await page.reload();
    await page.waitForLoadState("networkidle");

    const passwordValue = await page.getByLabel(/^password|^パスワード/i).inputValue();
    expect(passwordValue).toBe("__SEALION_DUMMY_SMTP_PASSWORD__");
  });
});

test.describe("SMTP Settings — US2: Test Send", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', ADMIN_EMAIL);
    await page.fill('[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
    await page.goto("/admin/smtp-settings");
    await expect(page.locator("form, .MuiPaper-root")).toBeVisible();
  });

  test("test send button is visible on the page", async ({ page }) => {
    await expect(page.getByRole("button", { name: /test email|テスト送信/i })).toBeVisible();
  });

  test("test send shows error notification when SMTP fails", async ({ page }) => {
    await page.getByLabel(/smtp host|SMTPホスト/i).fill("invalid.smtp.host.that.does.not.exist");
    await page.getByLabel(/port|ポート/i).fill("9999");
    await page.getByLabel(/from address|送信元アドレス/i).fill("fail@example.com");
    await page.getByLabel(/from name|送信者名/i).fill("Fail Test");

    await page.getByRole("button", { name: /test email|テスト送信/i }).click();

    await expect(page.getByText(/failed|失敗/i)).toBeVisible({ timeout: 35000 });
  });
});
