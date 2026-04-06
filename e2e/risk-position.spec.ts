import { test, expect } from '@playwright/test';

test.describe('Risk Position Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/risk-position');
    await page.waitForSelector('button:has-text("Open Risk Position")');
  });

  test('should open dialog on button click and close on Escape', async ({ page }) => {
    await page.click('button:has-text("Open Risk Position")');
    await expect(page.locator('mat-dialog-container')).toBeVisible();
    await expect(page.locator('h2:has-text("Risk Position")')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('mat-dialog-container')).not.toBeVisible();
  });

  test('should render all 6 dynamic column headers', async ({ page }) => {
    await page.click('button:has-text("Open Risk Position")');
    await page.waitForSelector('.ag-root-wrapper');

    const expectedHeaders = [
      'Qualified Tenor',
      'Reflex Position',
      'Manual Adjustment (K Units)',
      'Adjusted Reflex Position (K units)',
      'Target Position (K Units)',
      'Adjusted e-Position',
    ];

    for (const header of expectedHeaders) {
      await expect(page.locator(`.ag-header-cell-text:has-text("${header}")`)).toBeVisible();
    }

    const headerCount = await page.locator('.ag-header-cell').count();
    expect(headerCount).toBe(6);
  });

  test('should render rows with tenor data', async ({ page }) => {
    await page.click('button:has-text("Open Risk Position")');
    await page.waitForSelector('.ag-root-wrapper');

    // Wait for rows to render
    await page.waitForSelector('.ag-row');

    const rowCount = await page.locator('.ag-row').count();
    expect(rowCount).toBeGreaterThan(0);

    // Check first column cells contain expected tenor patterns
    const firstCellText = await page
      .locator('.ag-row[row-index="0"] .ag-cell[col-id="qualifiedTenor"]')
      .textContent();
    expect(firstCellText).toContain('Delta_O/N');
  });

  test('should display formatted numbers in numeric columns', async ({ page }) => {
    await page.click('button:has-text("Open Risk Position")');
    await page.waitForSelector('.ag-row');

    // Check Delta_10Y row which has value 2,886
    const delta10yRow = page.locator('.ag-row .ag-cell[col-id="qualifiedTenor"]:has-text("Delta_10Y")');
    await expect(delta10yRow).toBeVisible();

    const reflexCell = delta10yRow.locator('..').locator('.ag-cell[col-id="reflexPosition"]');
    const cellText = await reflexCell.textContent();
    expect(cellText?.trim()).toBe('2,886');
  });

  test('should update adjusted columns when multiplier changes', async ({ page }) => {
    await page.click('button:has-text("Open Risk Position")');
    await page.waitForSelector('.ag-row');

    // Get initial adjusted reflex value for first row (Delta_O/N = 3)
    const adjustedCell = page.locator(
      '.ag-row[row-index="0"] .ag-cell[col-id="adjustedReflexPosition"]',
    );
    const initialValue = await adjustedCell.textContent();
    expect(initialValue?.trim()).toBe('3');

    // Change Reflex Position Multiplier to 2
    const multiplierInput = page.locator('input[aria-label="Reflex Position Multiplier"]');
    await multiplierInput.clear();
    await multiplierInput.fill('2');
    await multiplierInput.press('Tab');

    // Wait for grid to update
    await page.waitForTimeout(500);

    // Adjusted value should now be 6
    const updatedValue = await adjustedCell.textContent();
    expect(updatedValue?.trim()).toBe('6');
  });

  test('should allow editing Manual Adjustment cells', async ({ page }) => {
    await page.click('button:has-text("Open Risk Position")');
    await page.waitForSelector('.ag-row');

    const manualCell = page.locator(
      '.ag-row[row-index="0"] .ag-cell[col-id="manualAdjustment"]',
    );

    // Double-click to edit
    await manualCell.dblclick();
    await page.keyboard.type('100');
    await page.keyboard.press('Enter');

    // Wait for update
    await page.waitForTimeout(300);

    const cellValue = await manualCell.textContent();
    expect(cellValue?.trim()).toBe('100');
  });

  test('should display status bar with MMU info', async ({ page }) => {
    await page.click('button:has-text("Open Risk Position")');
    await page.waitForSelector('.ag-root-wrapper');

    const statusBar = page.locator('app-risk-position-status-bar');
    await expect(statusBar).toBeVisible();
    await expect(statusBar.locator('text=MMU:')).toBeVisible();
    await expect(statusBar.locator('text=Long')).toBeVisible();
  });

  test('should display multiplier controls with default values', async ({ page }) => {
    await page.click('button:has-text("Open Risk Position")');
    await page.waitForSelector('.ag-root-wrapper');

    const reflexMultiplier = page.locator('input[aria-label="Reflex Position Multiplier"]');
    const manualMultiplier = page.locator('input[aria-label="Manual Adjustment Multiplier"]');
    const targetMultiplier = page.locator('input[aria-label="Target Position Multiplier"]');

    await expect(reflexMultiplier).toHaveValue('1');
    await expect(manualMultiplier).toHaveValue('1');
    await expect(targetMultiplier).toHaveValue('1');
  });

  test('should display spread curves input', async ({ page }) => {
    await page.click('button:has-text("Open Risk Position")');
    await page.waitForSelector('.ag-root-wrapper');

    const spreadInput = page.locator('input[aria-label="Spread Curves"]');
    await expect(spreadInput).toHaveValue('1M,6M,12M,OIS');
  });

  test('should have alternating row colors', async ({ page }) => {
    await page.click('button:has-text("Open Risk Position")');
    await page.waitForSelector('.ag-row');

    const row0Bg = await page.locator('.ag-row[row-index="0"]').evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    const row1Bg = await page.locator('.ag-row[row-index="1"]').evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );

    expect(row0Bg).not.toBe(row1Bg);
  });

  test('should trigger CSV export when Export Positions is clicked', async ({ page }) => {
    await page.click('button:has-text("Open Risk Position")');
    await page.waitForSelector('.ag-row');

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export Positions")');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('risk-positions.csv');
  });

  test('visual regression: full dialog', async ({ page }) => {
    await page.click('button:has-text("Open Risk Position")');
    await page.waitForSelector('.ag-row');

    // Wait for grid to fully render
    await page.waitForTimeout(1000);

    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toHaveScreenshot('risk-position-dialog.png', {
      maxDiffPixelRatio: 0.02,
    });
  });
});
