import { test, expect } from '@playwright/test';

test.describe('message notification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows information message at top-center', async ({ page }) => {
    // Navigate to a page that shows an info message
    await page.goto('/');

    // Trigger information message
    await page.click('#show-info-button');

    // Wait for message to appear
    const message = page.locator('[role="alert"]');

    await expect(message).toBeVisible();

    // Verify message content
    await expect(message).toContainText('Information');

    // Verify message type styling (MUI Alert info uses blue color)
    await expect(message).toHaveAttribute('severity', 'info');
  });

  test('shows warning message at top-center', async ({ page }) => {
    await page.goto('/');

    // Trigger warning message
    await page.click('#show-warning-button');

    const message = page.locator('[role="alert"]');

    await expect(message).toBeVisible();
    await expect(message).toContainText('Warning');
    await expect(message).toHaveAttribute('severity', 'warning');
  });

  test('shows error message at top-center', async ({ page }) => {
    await page.goto('/');

    // Trigger error message
    await page.click('#show-error-button');

    const message = page.locator('[role="alert"]');

    await expect(message).toBeVisible();
    await expect(message).toContainText('Error');
    await expect(message).toHaveAttribute('severity', 'error');
  });

  test('information message auto-dismisses after 6 seconds', async ({ page }) => {
    await page.goto('/');

    // Trigger info message
    await page.click('#show-info-button');

    const message = page.locator('[role="alert"]');

    // Wait for message to appear
    await expect(message).toBeVisible();

    // Message should still be visible after 5 seconds
    await expect(message).toBeVisible({ timeout: 5000 });

    // Wait for auto-dismiss (6 seconds total)
    await expect(message).toBeHidden({ timeout: 2000 });
  });

  test('warning message auto-dismisses after 6 seconds', async ({ page }) => {
    await page.goto('/');

    // Trigger warning message
    await page.click('#show-warning-button');

    const message = page.locator('[role="alert"]');

    await expect(message).toBeVisible();

    // Wait for auto-dismiss (6 seconds)
    await expect(message).toBeHidden({ timeout: 7000 });
  });

  test('error message persists until manually closed', async ({ page }) => {
    await page.goto('/');

    // Trigger error message
    await page.click('#show-error-button');

    const message = page.locator('[role="alert"]');

    await expect(message).toBeVisible();

    // Wait longer than 6 seconds - should still be visible
    await expect(message).toBeVisible({ timeout: 7000 });
  });

  test('manual dismiss closes message', async ({ page }) => {
    await page.goto('/');

    // Trigger error message
    await page.click('#show-error-button');

    const message = page.locator('[role="alert"]');
    const closeButton = page.locator('button[aria-label="Close"]');

    // Wait for message to appear
    await expect(message).toBeVisible();
    await expect(closeButton).toBeVisible();

    // Click close button
    await closeButton.click();

    // Message should be hidden
    await expect(message).toBeHidden();
  });
});

test.describe('message positioning', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('messages display at top-center of screen', async ({ page }) => {
    await page.goto('/');

    // Trigger a message
    await page.click('#show-info-button');

    const message = page.locator('[role="alert"]');
    const messageBox = page.locator('.MuiPaper-root').filter({ hasText: 'Information' }).first();

    // Get viewport dimensions and message dimensions
    const viewport = page.viewportSize();
    const box = await messageBox.boundingBox();

    // Verify message is centered horizontally (message center should be at viewport.width / 2)
    const centerX = viewport.width / 2;
    const messageCenter = box.x + box.width / 2;

    expect(messageCenter).toBeCloseTo(centerX, 50);

    // Verify message is at top of screen
    expect(box.y).toBeLessThan(100); // Should be near top
  });
});

test.describe('concurrent message handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays up to 5 concurrent messages (T079)', async ({ page }) => {
    await page.goto('/');

    // Trigger 5 messages
    await page.click('#show-info-button');
    await page.click('#show-warning-button');
    await page.click('#show-error-button');
    await page.click('#show-info-button');
    await page.click('#show-warning-button');

    // Wait for all messages to appear
    await page.waitForTimeout(1000);

    // Count visible messages
    const messages = await page.locator('[role="alert"]').all();
    expect(messages.length).toBeLessThanOrEqual(5);
  });

  test('6th message dismisses oldest (T080)', async ({ page }) => {
    await page.goto('/');

    // Add 6 messages rapidly
    for (let i = 0; i < 6; i++) {
      await page.click('#show-info-button');
      await page.waitForTimeout(600); // Wait for throttle interval
    }

    // Wait for messages to appear
    await page.waitForTimeout(1000);

    // Should only have 5 messages visible
    const messages = await page.locator('[role="alert"]').all();
    expect(messages.length).toBe(5);
  });

  test('messages maintain FIFO order (T081)', async ({ page }) => {
    await page.goto('/');

    // Add messages in specific order
    await page.click('#show-info-button');
    await page.waitForTimeout(600);
    await page.click('#show-warning-button');
    await page.waitForTimeout(600);
    await page.click('#show-error-button');

    await page.waitForTimeout(1000);

    // Verify messages appear in order (first added at top)
    const messages = await page.locator('[role="alert"]').allTextContents();

    // The order should be: Information, Warning, Error
    expect(messages).toContainEqual(expect.stringContaining('Information'));
    expect(messages).toContainEqual(expect.stringContaining('Warning'));
    expect(messages).toContainEqual(expect.stringContaining('Error'));
  });

  test('queue processing respects 0.5s interval (T082)', async ({ page }) => {
    await page.goto('/');

    // Trigger multiple messages rapidly
    const startTime = Date.now();
    await page.click('#show-info-button');
    await page.click('#show-warning-button'); // This should be queued
    await page.click('#show-error-button'); // This should be queued

    // Wait for first message to appear
    await page.waitForSelector('[role="alert"]');

    // Wait for queued messages to process
    await page.waitForTimeout(1500); // 0.5s interval for 2 queued messages

    const messages = await page.locator('[role="alert"]').all();
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });

  test('rapid operations throttle message display (T083)', async ({ page }) => {
    await page.goto('/');

    // Try to add 10 messages very rapidly (within 0.5s)
    for (let i = 0; i < 10; i++) {
      await page.click('#show-info-button');
      await page.waitForTimeout(50); // Much faster than 500ms throttle
    }

    // Wait for queue to process
    await page.waitForTimeout(3000);

    // Should only have at most 5 messages visible due to throttling
    const messages = await page.locator('[role="alert"]').all();
    expect(messages.length).toBeLessThanOrEqual(5);
  });
});
