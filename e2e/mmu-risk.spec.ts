import { expect, Page, test } from '@playwright/test';

async function openDialog(page: Page): Promise<void> {
  await page.goto('/mmu-risk');
  await page.waitForSelector('button:has-text("Open MMU Risk")');
  await page.click('button:has-text("Open MMU Risk")');
  await page.waitForSelector('mat-dialog-container');
}

async function selectMmuAndProceed(page: Page, mmuName: string): Promise<void> {
  await page.locator('mat-dialog-container mat-select').click();
  await page.locator('mat-option', { hasText: mmuName }).click();
  await page.click('mat-dialog-container button[aria-label="Proceed with selected MMU"]');
  await page.waitForSelector('mat-dialog-container', { state: 'detached' });
  await page.waitForSelector('app-mmu-risk-panel');
  await page.waitForSelector('.ag-row');
}

test.describe('MMU Risk — modal gate flow', () => {
  test('panel is hidden until Open MMU Risk is clicked', async ({ page }) => {
    await page.goto('/mmu-risk');
    await page.waitForSelector('button:has-text("Open MMU Risk")');
    await expect(page.locator('app-mmu-risk-panel')).toHaveCount(0);
    await expect(page.locator('mat-dialog-container')).toHaveCount(0);
  });

  test('clicking Open MMU Risk opens the selector dialog (not the panel)', async ({ page }) => {
    await openDialog(page);
    await expect(page.locator('mat-dialog-container')).toBeVisible();
    await expect(page.locator('mat-dialog-container h2')).toHaveText(/Select MMU/i);
    await expect(page.locator('app-mmu-risk-panel')).toHaveCount(0);
  });

  test('dialog lists MMU names from user-mappings API', async ({ page }) => {
    await openDialog(page);
    await page.locator('mat-dialog-container mat-select').click();
    const options = page.locator('mat-option');
    await expect(options).toHaveCount(3);
    await expect(options.nth(0)).toHaveText(/EUR_SWAP_DESK/);
    await expect(options.nth(1)).toHaveText(/USD_RATES_DESK/);
    await expect(options.nth(2)).toHaveText(/GBP_GILTS_DESK/);
  });

  test('Proceed is disabled until an MMU is selected', async ({ page }) => {
    await openDialog(page);
    const proceed = page.locator('button[aria-label="Proceed with selected MMU"]');
    await expect(proceed).toBeDisabled();
    await page.locator('mat-dialog-container mat-select').click();
    await page.locator('mat-option', { hasText: 'EUR_SWAP_DESK' }).click();
    await expect(proceed).toBeEnabled();
  });

  test('Cancel closes dialog without revealing the panel', async ({ page }) => {
    await openDialog(page);
    await page.click('mat-dialog-container button[aria-label="Cancel MMU selection"]');
    await expect(page.locator('mat-dialog-container')).toHaveCount(0);
    await expect(page.locator('app-mmu-risk-panel')).toHaveCount(0);
  });

  test('Proceed closes dialog and reveals the grid panel', async ({ page }) => {
    await openDialog(page);
    await selectMmuAndProceed(page, 'EUR_SWAP_DESK');
    await expect(page.locator('app-mmu-risk-panel')).toBeVisible();
    await expect(page.locator('mat-dialog-container')).toHaveCount(0);
  });
});

test.describe('MMU Risk — panel after MMU selection', () => {
  test.beforeEach(async ({ page }) => {
    await openDialog(page);
    await selectMmuAndProceed(page, 'EUR_SWAP_DESK');
  });

  test('header reflects the selected MMU name and shows the Change MMU button', async ({ page }) => {
    await expect(page.locator('#mmu-risk-panel-title')).toContainText('EUR_SWAP_DESK');
    await expect(page.locator('button[aria-label="Change MMU"]')).toBeVisible();
  });

  test('grid renders the 6 contract columns in order', async ({ page }) => {
    const headers = await page.locator('.ag-header-cell-text').allTextContents();
    expect(headers).toEqual([
      'Tenor',
      'Reflex Position',
      'Manual Adjustment',
      'Adjusted Reflex Position',
      'Target Position',
      'Adjusted E-Position',
    ]);
  });

  test('Tenor and Reflex Position do not enter edit mode on double-click', async ({ page }) => {
    await page.locator('.ag-row[row-index="0"] .ag-cell[col-id="tenor"]').dblclick();
    await expect(page.locator('.ag-cell-inline-editing')).toHaveCount(0);
    await page.locator('.ag-row[row-index="0"] .ag-cell[col-id="reflexPosition"]').dblclick();
    await expect(page.locator('.ag-cell-inline-editing')).toHaveCount(0);
  });

  test('Manual Adjustment and Target Position enter edit mode on double-click', async ({ page }) => {
    await page.locator('.ag-row[row-index="0"] .ag-cell[col-id="manualAdjustment"]').dblclick();
    await expect(page.locator('.ag-cell-inline-editing')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.locator('.ag-row[row-index="0"] .ag-cell[col-id="targetPosition"]').dblclick();
    await expect(page.locator('.ag-cell-inline-editing')).toHaveCount(1);
    await page.keyboard.press('Escape');
  });

  test('Adjusted columns do not enter edit mode (computed)', async ({ page }) => {
    await page
      .locator('.ag-row[row-index="0"] .ag-cell[col-id="adjustedReflexPosition"]')
      .dblclick();
    await expect(page.locator('.ag-cell-inline-editing')).toHaveCount(0);
    await page.locator('.ag-row[row-index="0"] .ag-cell[col-id="adjustedEPosition"]').dblclick();
    await expect(page.locator('.ag-cell-inline-editing')).toHaveCount(0);
  });

  test('per-column background colors are as specified', async ({ page }) => {
    const bgOf = async (colId: string): Promise<string> => {
      return page
        .locator(`.ag-row[row-index="0"] .ag-cell[col-id="${colId}"]`)
        .evaluate((el) => getComputedStyle(el as HTMLElement).backgroundColor);
    };

    const BLUE = 'rgb(135, 206, 250)';
    const YELLOW = 'rgb(250, 250, 210)';
    const WHITE = 'rgb(255, 255, 255)';

    expect(await bgOf('tenor')).toBe(BLUE);
    expect(await bgOf('reflexPosition')).toBe(BLUE);
    expect(await bgOf('manualAdjustment')).toBe(WHITE);
    expect(await bgOf('adjustedReflexPosition')).toBe(YELLOW);
    expect(await bgOf('targetPosition')).toBe(WHITE);
    expect(await bgOf('adjustedEPosition')).toBe(YELLOW);
  });

  test('editing Manual Adjustment updates Adjusted Reflex Position in the same row', async ({
    page,
  }) => {
    const manual = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="manualAdjustment"]');
    const adjReflex = page.locator(
      '.ag-row[row-index="0"] .ag-cell[col-id="adjustedReflexPosition"]',
    );
    const reflex = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="reflexPosition"]');

    const reflexText = await reflex.textContent();
    const reflexNum = Number(reflexText?.replace(/,/g, '') ?? '0');

    await manual.dblclick();
    await page.keyboard.type('7');
    await page.keyboard.press('Enter');

    await expect(manual).toHaveText('7');
    await expect(adjReflex).toHaveText(String(reflexNum + 7));
  });

  test('Reflex Position Multiplier updates Reflex + Adjusted columns, not the raw', async ({
    page,
  }) => {
    const reflex = page.locator('.ag-row[row-index="0"] .ag-cell[col-id="reflexPosition"]');
    const adjReflex = page.locator(
      '.ag-row[row-index="0"] .ag-cell[col-id="adjustedReflexPosition"]',
    );
    const reflexBefore = Number((await reflex.textContent())?.replace(/,/g, '') ?? '0');

    const rMult = page.locator('input[aria-label="Reflex Position Multiplier"]');
    await rMult.fill('');
    await rMult.fill('2');
    await rMult.blur();

    await expect(reflex).toHaveText(String(reflexBefore * 2));
    // manual default is 0, so adjustedReflex = reflex*2 + 0*m = reflex*2
    await expect(adjReflex).toHaveText(String(reflexBefore * 2));
  });

  test('controls: multiplier defaults are 1, spread curves seeded, override toggle is gone', async ({
    page,
  }) => {
    await expect(page.locator('input[aria-label="Reflex Position Multiplier"]')).toHaveValue('1');
    await expect(page.locator('input[aria-label="Manual Adjustment Multiplier"]')).toHaveValue('1');
    await expect(page.locator('input[aria-label="Target Position Multiplier"]')).toHaveValue('1');
    await expect(page.locator('input[aria-label="Spread Curves"]')).toHaveValue('1M,6M,12M,OIS');
    await expect(page.locator('[aria-label*="Override source"]')).toHaveCount(0);
  });

  test('control fieldsets align to equal height', async ({ page }) => {
    const heights = await page
      .locator('.controls-row > .control-group')
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    expect(heights.length).toBe(3);
    const min = Math.min(...heights);
    const max = Math.max(...heights);
    // Stretch alignment — all fieldsets within a few px of each other.
    expect(max - min).toBeLessThanOrEqual(4);
  });

  test('Refresh Risk stays clickable and independent', async ({ page }) => {
    const refreshRisk = page.locator('button[aria-label="Refresh Risk"]');
    await expect(refreshRisk).toBeEnabled();
    await refreshRisk.click();
    await expect(refreshRisk).toHaveText(/Refreshing Risk/);
    await expect(refreshRisk).toBeEnabled();
  });

  test('Export Positions surfaces a dismissible success banner', async ({ page }) => {
    await page.click('button[aria-label="Export Positions"]');
    const banner = page.locator('.export-banner.success');
    await expect(banner).toBeVisible();
    await banner.locator('button[aria-label="Dismiss export message"]').click();
    await expect(banner).toHaveCount(0);
  });

  test('status bar shows MMU name and snapshot timestamp, no direction badge', async ({ page }) => {
    const statusBar = page.locator('app-mmu-risk-status-bar');
    await expect(statusBar).toContainText('MMU:');
    await expect(statusBar).toContainText('EUR_SWAP_DESK');
    await expect(statusBar).toContainText('Snapshot:');
    await expect(statusBar).toContainText('Last publish:');
    await expect(statusBar).not.toContainText(/\bLong\b|\bShort\b|\bFlat\b/);
  });

  test('Change MMU button opens the dialog pre-selected and swaps MMU on proceed', async ({
    page,
  }) => {
    await page.click('button[aria-label="Change MMU"]');
    await expect(page.locator('mat-dialog-container')).toBeVisible();
    // Pre-selected — proceed is enabled without a click
    const proceed = page.locator('button[aria-label="Proceed with selected MMU"]');
    await expect(proceed).toBeEnabled();

    // Pick a different MMU
    await page.locator('mat-dialog-container mat-select').click();
    await page.locator('mat-option', { hasText: 'USD_RATES_DESK' }).click();
    await proceed.click();

    await page.waitForSelector('mat-dialog-container', { state: 'detached' });
    await expect(page.locator('#mmu-risk-panel-title')).toContainText('USD_RATES_DESK');
  });

  test('close + reopen triggers the dialog fresh (no pre-selection)', async ({ page }) => {
    await page.click('button:has-text("Close MMU Risk")');
    await expect(page.locator('app-mmu-risk-panel')).toHaveCount(0);

    await page.click('button:has-text("Open MMU Risk")');
    await expect(page.locator('mat-dialog-container')).toBeVisible();
    await expect(page.locator('button[aria-label="Proceed with selected MMU"]')).toBeDisabled();
    await page.click('button[aria-label="Cancel MMU selection"]');
  });
});

test.describe('MMU Risk — keyboard shortcuts', () => {
  test('Ctrl+A opens the dialog, Escape closes it', async ({ page }) => {
    await page.goto('/mmu-risk');
    await page.waitForSelector('button:has-text("Open MMU Risk")');

    await page.keyboard.press('Control+KeyA');
    await expect(page.locator('mat-dialog-container')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('mat-dialog-container')).toHaveCount(0);
  });
});
