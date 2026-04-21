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

  test('header reflects the selected MMU name', async ({ page }) => {
    await expect(page.locator('#mmu-risk-panel-title')).toContainText('EUR_SWAP_DESK');
  });

  test('grid renders the contract columns (static, no dynamic schema)', async ({ page }) => {
    const expected = [
      'Tenor',
      'Reflex Position',
      'Manual Adjustment',
      'Adjusted Reflex Position',
      'Target Position',
      'Adjusted E-Position',
    ];
    const headers = await page.locator('.ag-header-cell-text').allTextContents();
    expect(headers).toEqual(expected);
  });

  test('renders rows keyed by tenor with parsed numeric values', async ({ page }) => {
    const firstTenor = await page
      .locator('.ag-row[row-index="0"] .ag-cell[col-id="tenor"]')
      .textContent();
    expect(firstTenor).toContain('Delta_O/N');

    const reflex = await page
      .locator('.ag-row[row-index="0"] .ag-cell[col-id="reflexPosition"]')
      .textContent();
    expect(reflex?.trim()).toBe('3');
  });

  test('controls show defaults: multipliers=1, spread curves seeded, override=risk', async ({
    page,
  }) => {
    await expect(page.locator('input[aria-label="Reflex Position Multiplier"]')).toHaveValue('1');
    await expect(page.locator('input[aria-label="Manual Adjustment Multiplier"]')).toHaveValue('1');
    await expect(page.locator('input[aria-label="Target Position Multiplier"]')).toHaveValue('1');
    await expect(page.locator('input[aria-label="Spread Curves"]')).toHaveValue('1M,6M,12M,OIS');

    const toggle = page.locator('button[role="switch"][aria-label*="Override source"]');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('.override-label.active', { hasText: 'Risk wins' })).toBeVisible();
  });

  test('override toggle flips active label and keeps the same columns', async ({ page }) => {
    await expect(page.locator('.override-label.active', { hasText: 'Risk wins' })).toBeVisible();
    const toggle = page.locator('button[role="switch"][aria-label*="Override source"]');
    await toggle.click();
    await expect(page.locator('.override-label.active', { hasText: 'Inputs wins' })).toBeVisible();
    const headerCount = await page.locator('.ag-header-cell').count();
    expect(headerCount).toBe(6);
  });

  test('Refresh Risk stays clickable and updates snapshot', async ({ page }) => {
    const refreshRisk = page.locator('button[aria-label="Refresh Risk"]');
    await expect(refreshRisk).toBeEnabled();
    await refreshRisk.click();
    await expect(refreshRisk).toHaveText(/Refreshing Risk/);
    await expect(refreshRisk).toBeEnabled();
    await expect(refreshRisk).toHaveText(/^\s*Refresh Risk\s*$/);
  });

  test('Refresh Inputs stays clickable independently of Refresh Risk', async ({ page }) => {
    const refreshRisk = page.locator('button[aria-label="Refresh Risk"]');
    const refreshInputs = page.locator('button[aria-label="Refresh Inputs"]');
    await refreshInputs.click();
    await expect(refreshInputs).toBeDisabled();
    await expect(refreshRisk).toBeEnabled();
    await expect(refreshInputs).toBeEnabled();
  });

  test('spread curves input is editable (no longer read-only)', async ({ page }) => {
    const input = page.locator('input[aria-label="Spread Curves"]');
    await expect(input).toBeEditable();
    await input.fill('2Y,5Y,10Y');
    await expect(input).toHaveValue('2Y,5Y,10Y');
  });

  test('Export Positions surfaces a success banner (no CSV download)', async ({ page }) => {
    const downloads: string[] = [];
    page.on('download', (d) => downloads.push(d.suggestedFilename()));

    await page.click('button[aria-label="Export Positions"]');
    await expect(page.locator('.export-banner.success')).toContainText(
      'Positions exported successfully',
    );
    expect(downloads).toEqual([]);
  });

  test('status bar shows MMU name and snapshot timestamp, no direction badge', async ({ page }) => {
    const statusBar = page.locator('app-mmu-risk-status-bar');
    await expect(statusBar).toBeVisible();
    await expect(statusBar).toContainText('MMU:');
    await expect(statusBar).toContainText('EUR_SWAP_DESK');
    await expect(statusBar).toContainText('Snapshot:');
    await expect(statusBar).toContainText('Last publish:');
    await expect(statusBar).not.toContainText(/\bLong\b/);
    await expect(statusBar).not.toContainText(/\bShort\b/);
    await expect(statusBar).not.toContainText(/\bFlat\b/);
  });

  test('no include-risk-columns toggle exists (feature removed)', async ({ page }) => {
    await expect(
      page.locator('[aria-label*="Inputs response includes risk-overlap columns"]'),
    ).toHaveCount(0);
  });

  test('close + reopen triggers the dialog again', async ({ page }) => {
    await page.click('button:has-text("Close MMU Risk")');
    await expect(page.locator('app-mmu-risk-panel')).toHaveCount(0);

    await page.click('button:has-text("Open MMU Risk")');
    await expect(page.locator('mat-dialog-container')).toBeVisible();
    await page.click('mat-dialog-container button[aria-label="Cancel MMU selection"]');
  });

  test('logs events for refresh, override, export, close', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'log' && msg.text().includes('[mmu-risk]')) {
        logs.push(msg.text());
      }
    });

    await page.click('button[aria-label="Refresh Risk"]');
    await expect(page.locator('button[aria-label="Refresh Risk"]')).toBeEnabled();
    await page.click('button[aria-label="Refresh Inputs"]');
    await expect(page.locator('button[aria-label="Refresh Inputs"]')).toBeEnabled();
    await page.locator('button[role="switch"][aria-label*="Override source"]').click();
    await page.click('button[aria-label="Export Positions"]');
    await expect(page.locator('.export-banner.success')).toBeVisible();
    await page.click('button:has-text("Close MMU Risk")');

    const joined = logs.join('\n');
    expect(joined).toContain('[mmu-risk] Refresh Risk clicked');
    expect(joined).toContain('[mmu-risk] Refresh Inputs clicked');
    expect(joined).toContain('[mmu-risk] Override toggle changed');
    expect(joined).toContain('[mmu-risk] Export Positions clicked');
    expect(joined).toContain('[mmu-risk] Close MMU Risk clicked');
  });
});

test.describe('MMU Risk — logging during selection', () => {
  test('logs MMU selected when user picks one and clicks Proceed', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'log' && msg.text().includes('[mmu-risk]')) {
        logs.push(msg.text());
      }
    });
    await openDialog(page);
    await selectMmuAndProceed(page, 'USD_RATES_DESK');
    const joined = logs.join('\n');
    expect(joined).toContain('[mmu-risk] Open MMU Risk clicked');
    expect(joined).toContain('[mmu-risk] MMU selected');
    expect(joined).toContain('USD_RATES_DESK');
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
