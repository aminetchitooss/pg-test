import { test, expect } from '@playwright/test';

test.describe('Monaco JSON Editor - Intellisense & Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4200');
    // Wait for Monaco editor to initialize
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });
    // Give the JSON worker time to start
    await page.waitForTimeout(3000);
  });

  test('schema intellisense shows client, server, version suggestions', async ({ page }) => {
    // Click inside the editor to focus it
    await page.locator('.monaco-editor .view-lines').click();
    await page.waitForTimeout(500);

    // Type a JSON object and position cursor inside for property suggestions
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('{}', { delay: 50 });
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight'); // cursor after {
    await page.keyboard.press('Enter');
    await page.keyboard.type('"', { delay: 100 });
    await page.waitForTimeout(1000);

    // Trigger autocomplete programmatically
    await page.evaluate(() => {
      const ta = document.querySelector('.monaco-editor textarea') as HTMLTextAreaElement;
      ta?.focus();
      ta?.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', ctrlKey: true, bubbles: true })
      );
    });

    // The suggest widget should appear
    const suggestWidget = page.locator('.editor-widget.suggest-widget');
    await expect(suggestWidget).toBeVisible({ timeout: 10000 });

    // Check that schema properties appear in suggestion labels
    const labels = suggestWidget.locator('.monaco-list-row .label-name span');
    const allLabels = await labels.allTextContents();
    expect(allLabels).toContain('version');
    expect(allLabels).toContain('server');
    expect(allLabels).toContain('client');
  });

  test('validation warnings show for invalid JSON', async ({ page }) => {
    // Click inside the editor to focus it
    await page.locator('.monaco-editor .view-lines').click();
    await page.waitForTimeout(500);

    // Type invalid JSON
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('{ invalid }', { delay: 30 });

    // Wait for validation markers to appear
    await page.waitForTimeout(3000);

    // Check for error markers (squiggly lines)
    const errorMarkers = page.locator('.squiggly-error');
    await expect(errorMarkers.first()).toBeVisible({ timeout: 5000 });
  });

  test('{C} and {D} custom completions appear when typing {', async ({ page }) => {
    // Click inside the editor to focus it
    await page.locator('.monaco-editor .view-lines').click();
    await page.waitForTimeout(500);

    // Type JSON with a token field value starting with {
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('{\n"token": "{', { delay: 50 });
    await page.waitForTimeout(1000);

    // The { trigger character should have opened completions
    // If not, try triggering manually
    const suggestWidget = page.locator('.editor-widget.suggest-widget');
    const isVisible = await suggestWidget.isVisible().catch(() => false);
    if (!isVisible) {
      await page.keyboard.press('Control+Space');
    }

    await expect(suggestWidget).toBeVisible({ timeout: 10000 });

    const suggestText = await suggestWidget.textContent();
    expect(suggestText).toContain('{C}');
    expect(suggestText).toContain('{D}');
  });
});
