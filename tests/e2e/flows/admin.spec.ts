import { test, expect } from "@playwright/test";

test.describe("Admin User Management", () => {
  test.beforeEach(async ({ page }) => {
    // Log in as admin
    await page.goto("http://app:3000/login");
    await page.fill('[name="email"]', process.env.E2E_ADMIN_EMAIL ?? "admin@example.com");
    await page.fill('[name="password"]', process.env.E2E_ADMIN_PASSWORD ?? "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("http://app:3000/");
  });

  // ---------- US1: User List ----------

  test("admin can see System Administration menu in sidebar", async ({ page }) => {
    const sidebar = page.getByTestId("sidebar");
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText(/system administration|システム管理/i)).toBeVisible();
  });

  test("admin can navigate to user management via sidebar", async ({ page }) => {
    const sidebar = page.getByTestId("sidebar");
    await sidebar.getByText(/system administration|システム管理/i).click();
    await sidebar.getByText(/user management|ユーザー管理/i).click();
    await page.waitForURL(/admin\/users/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("non-admin cannot see System Administration menu", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("http://app:3000/login");
    await page.fill('[name="email"]', process.env.E2E_USER_EMAIL ?? "user@example.com");
    await page.fill('[name="password"]', process.env.E2E_USER_PASSWORD ?? "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("http://app:3000/");

    const sidebar = page.getByTestId("sidebar");
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText(/system administration|システム管理/i)).not.toBeVisible();

    await context.close();
  });

  test("non-admin gets 403 on direct URL access to /admin/users", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("http://app:3000/login");
    await page.fill('[name="email"]', process.env.E2E_USER_EMAIL ?? "user@example.com");
    await page.fill('[name="password"]', process.env.E2E_USER_PASSWORD ?? "password123");
    await page.click('button[type="submit"]');

    await page.goto("http://app:3000/admin/users");
    await page.waitForTimeout(1000);

    const body = await page.locator("body").textContent();
    const isBlocked =
      (body?.toLowerCase().includes("forbidden") ?? false) ||
      (body?.toLowerCase().includes("403") ?? false) ||
      !page.url().includes("admin/users");

    expect(isBlocked).toBeTruthy();
    await context.close();
  });

  test("admin page is accessible for admin users", async ({ page }) => {
    await page.goto("http://app:3000/admin/users");
    await page.waitForURL(/admin\/users/, { timeout: 5000 });
    await expect(page.getByRole("heading")).toBeVisible();
  });

  test("admin page loads without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("http://app:3000/admin/users");
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test("dashboard is accessible after login", async ({ page }) => {
    await expect(page).toHaveURL("http://app:3000/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  // ---------- US2: Create User ----------

  test("admin can create a new user via modal", async ({ page }) => {
    await page.goto("http://app:3000/admin/users");
    await page.getByRole("button", { name: /create user|ユーザーを作成/i }).click();
    await page.getByLabel(/email/i).fill("newuser@example.com");
    await page.getByLabel(/display name|表示名/i).fill("New Test User");
    await page.getByLabel(/password|パスワード/i).fill("password123");
    await page.getByRole("button", { name: /create user|ユーザーを作成/i }).last().click();
    // Success: modal closes and list shows the new user
    await expect(page.getByText("newuser@example.com")).toBeVisible({ timeout: 5000 });
  });

  test("admin sees validation error when creating user with missing email", async ({ page }) => {
    await page.goto("http://app:3000/admin/users");
    await page.getByRole("button", { name: /create user|ユーザーを作成/i }).click();
    await page.getByLabel(/password|パスワード/i).fill("password123");
    await page.getByRole("button", { name: /create user|ユーザーを作成/i }).last().click();
    // Error or browser validation prevents submission
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  // ---------- US3: Edit User ----------

  test("admin can edit a user via edit button", async ({ page }) => {
    await page.goto("http://app:3000/admin/users");
    // Click the first Edit button in the table
    await page.getByRole("button", { name: /^edit|^編集/i }).first().click();
    // Modal should open with form fields
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel(/display name|表示名/i)).toBeVisible();
  });

  test("admin sees role field disabled when editing own account", async ({ page }) => {
    await page.goto("http://app:3000/admin/users");
    // Find the row for the logged-in admin and click its Edit button
    // We identify it by matching the admin email in the same row
    const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
    const row = page.getByRole("row").filter({ hasText: adminEmail });
    await row.getByRole("button", { name: /^edit|^編集/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // Role select should be disabled
    const roleSelect = page.getByRole("dialog").getByLabel(/^role|^ロール/i);
    await expect(roleSelect).toBeDisabled();
  });

  // ---------- US4: Delete User ----------

  test("admin sees confirmation dialog when clicking delete", async ({ page }) => {
    await page.goto("http://app:3000/admin/users");
    await page.getByRole("button", { name: /^delete|^削除/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: /^delete|^削除/i })).toBeVisible();
  });

  test("admin cannot delete their own account", async ({ page }) => {
    await page.goto("http://app:3000/admin/users");
    const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
    const row = page.getByRole("row").filter({ hasText: adminEmail });
    const deleteButton = row.getByRole("button", { name: /^delete|^削除/i });
    // Delete button should be disabled or absent for own account
    const isDisabled = await deleteButton.isDisabled().catch(() => true);
    expect(isDisabled).toBeTruthy();
  });
});
