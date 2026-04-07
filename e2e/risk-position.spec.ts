import { test, expect } from '@playwright/test';

function parseRgb(rgb: string): { r: number; g: number; b: number } {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return match
    ? { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) }
    : { r: 0, g: 0, b: 0 };
}

function isClose(a: number, b: number, tolerance = 10): boolean {
  return Math.abs(a - b) <= tolerance;
}

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
      await expect(
        page.locator('.ag-header-cell-text', { hasText: new RegExp(`^${header.replace(/[()]/g, '\\$&')}$`) }),
      ).toBeVisible();
    }

    const headerCount = await page.locator('.ag-header-cell').count();
    expect(headerCount).toBe(6);
  });

  test('should render rows with tenor data', async ({ page }) => {
    await page.click('button:has-text("Open Risk Position")');
    await page.waitForSelector('.ag-root-wrapper');
    await page.waitForSelector('.ag-row');

    const rowCount = await page.locator('.ag-row').count();
    expect(rowCount).toBeGreaterThan(0);

    const firstCellText = await page
      .locator('.ag-row[row-index="0"] .ag-cell[col-id="qualifiedTenor"]')
      .textContent();
    expect(firstCellText).toContain('Delta_O/N');
  });

  test('should display formatted numbers in numeric columns', async ({ page }) => {
    await page.click('button:has-text("Open Risk Position")');
    await page.waitForSelector('.ag-row');

    const delta10yRow = page.locator(
      '.ag-row .ag-cell[col-id="qualifiedTenor"]:has-text("Delta_10Y")',
    );
    await expect(delta10yRow).toBeVisible();

    const reflexCell = delta10yRow.locator('..').locator('.ag-cell[col-id="reflexPosition"]');
    const cellText = await reflexCell.textContent();
    expect(cellText?.trim()).toBe('2,886');
  });

  test('should update adjusted columns when multiplier changes', async ({ page }) => {
    await page.click('button:has-text("Open Risk Position")');
    await page.waitForSelector('.ag-row');

    const adjustedCell = page.locator(
      '.ag-row[row-index="0"] .ag-cell[col-id="adjustedReflexPosition"]',
    );
    const initialValue = await adjustedCell.textContent();
    expect(initialValue?.trim()).toBe('3');

    const multiplierInput = page.locator('input[aria-label="Reflex Position Multiplier"]');
    await multiplierInput.clear();
    await multiplierInput.fill('2');
    await multiplierInput.press('Tab');

    await page.waitForTimeout(500);

    const updatedValue = await adjustedCell.textContent();
    expect(updatedValue?.trim()).toBe('6');
  });

  test('should allow editing Manual Adjustment cells', async ({ page }) => {
    await page.click('button:has-text("Open Risk Position")');
    await page.waitForSelector('.ag-row');

    const manualCell = page.locator(
      '.ag-row[row-index="0"] .ag-cell[col-id="manualAdjustment"]',
    );

    await manualCell.dblclick();
    await page.keyboard.type('100');
    await page.keyboard.press('Enter');

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

  test('should trigger CSV export when Export Positions is clicked', async ({ page }) => {
    await page.click('button:has-text("Open Risk Position")');
    await page.waitForSelector('.ag-row');

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export Positions")');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('risk-positions.csv');
  });
});

test.describe('Risk Position Grid Styling (pixel-perfect)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/risk-position');
    await page.click('button:has-text("Open Risk Position")');
    await page.waitForSelector('.ag-row');
  });

  test('should have alternating row colors (two blue shades)', async ({ page }) => {
    // Even row (index 0) — #dce6f5 → rgb(220, 230, 245)
    const row0Bg = await page.locator('.ag-row[row-index="0"]').evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    // Odd row (index 1) — #eaf1fa → rgb(234, 241, 250)
    const row1Bg = await page.locator('.ag-row[row-index="1"]').evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );

    // Row colors must differ (alternating)
    expect(row0Bg).not.toBe(row1Bg);

    // Both must be blue-tinted (b >= r)
    const c0 = parseRgb(row0Bg);
    const c1 = parseRgb(row1Bg);
    expect(c0.b).toBeGreaterThanOrEqual(c0.r);
    expect(c1.b).toBeGreaterThanOrEqual(c1.r);
  });

  test('should have compact row height (~26px)', async ({ page }) => {
    const rowHeight = await page.locator('.ag-row[row-index="0"]').evaluate(
      (el) => el.getBoundingClientRect().height,
    );
    expect(rowHeight).toBeGreaterThanOrEqual(24);
    expect(rowHeight).toBeLessThanOrEqual(30);
  });

  test('should have compact header height (~30px)', async ({ page }) => {
    const headerHeight = await page.locator('.ag-header-row').evaluate(
      (el) => el.getBoundingClientRect().height,
    );
    expect(headerHeight).toBeGreaterThanOrEqual(28);
    expect(headerHeight).toBeLessThanOrEqual(34);
  });

  test('should use small font size (~12px)', async ({ page }) => {
    const fontSize = await page.locator('.ag-row[row-index="0"] .ag-cell').first().evaluate(
      (el) => getComputedStyle(el).fontSize,
    );
    expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(11);
    expect(parseFloat(fontSize)).toBeLessThanOrEqual(13);
  });

  test('should right-align numeric columns', async ({ page }) => {
    const reflexCell = page.locator(
      '.ag-row[row-index="0"] .ag-cell[col-id="reflexPosition"]',
    );
    // cellStyle sets textAlign: right inline
    const textAlign = await reflexCell.evaluate(
      (el) => (el as HTMLElement).style.textAlign || getComputedStyle(el).textAlign,
    );
    expect(textAlign).toBe('right');
  });

  test('should have cream/yellow background on editable cells', async ({ page }) => {
    const editableCell = page.locator(
      '.ag-row[row-index="0"] .ag-cell[col-id="manualAdjustment"]',
    );
    // cellStyle sets backgroundColor inline
    const bg = await editableCell.evaluate(
      (el) => (el as HTMLElement).style.backgroundColor || getComputedStyle(el).backgroundColor,
    );
    const c = parseRgb(bg);

    // Should be warm/yellowish — red channel > blue channel (cream tint)
    expect(c.r).toBeGreaterThan(c.b);
    // Should be light overall
    expect(c.r).toBeGreaterThan(200);
    expect(c.g).toBeGreaterThan(200);
  });

  test('editable cells on odd rows should also have cream tint', async ({ page }) => {
    const editableCell = page.locator(
      '.ag-row[row-index="1"] .ag-cell[col-id="manualAdjustment"]',
    );
    const bg = await editableCell.evaluate(
      (el) => (el as HTMLElement).style.backgroundColor || getComputedStyle(el).backgroundColor,
    );
    const c = parseRgb(bg);

    expect(c.r).toBeGreaterThan(c.b);
    expect(c.r).toBeGreaterThan(200);
  });

  test('should have visible column borders', async ({ page }) => {
    const borderRight = await page
      .locator('.ag-row[row-index="0"] .ag-cell')
      .first()
      .evaluate((el) => getComputedStyle(el).borderRightWidth);
    const borderWidth = parseFloat(borderRight);
    expect(borderWidth).toBeGreaterThanOrEqual(1);
  });

  test('non-editable numeric cells should NOT have cream tint', async ({ page }) => {
    const reflexCell = page.locator(
      '.ag-row[row-index="0"] .ag-cell[col-id="reflexPosition"]',
    );
    const bg = await reflexCell.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    const c = parseRgb(bg);

    // Should be blue-ish (blue >= red) or transparent (inherits row color)
    // Not yellow/cream
    expect(c.b).toBeGreaterThanOrEqual(c.r - 15);
  });

  test('status bar should have muted gray background', async ({ page }) => {
    const statusBg = await page.locator('.status-bar').evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    const c = parseRgb(statusBg);
    // Gray means r ≈ g ≈ b, all around 220-240 range
    expect(isClose(c.r, c.g, 5) && isClose(c.g, c.b, 5)).toBe(true);
    expect(c.r).toBeGreaterThan(200);
  });

  test('status warning text should be red', async ({ page }) => {
    const warningColor = await page.locator('.status-warning').evaluate(
      (el) => getComputedStyle(el).color,
    );
    const c = parseRgb(warningColor);
    expect(c.r).toBeGreaterThan(180);
    expect(c.g).toBeLessThan(80);
    expect(c.b).toBeLessThan(80);
  });
});
