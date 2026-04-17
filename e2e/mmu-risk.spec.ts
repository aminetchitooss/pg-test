import { expect, test } from '@playwright/test';

test.describe('MMU Risk Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mmu-risk');
    await page.waitForSelector('button:has-text("Open MMU Risk")');
  });

  test('panel is hidden by default and toggles inline on click', async ({ page }) => {
    await expect(page.locator('app-mmu-risk-panel')).toHaveCount(0);

    const toggleBtn = page.locator('button', { hasText: /Open MMU Risk|Close MMU Risk/ });
    await toggleBtn.click();
    await expect(page.locator('app-mmu-risk-panel')).toBeVisible();
    await expect(toggleBtn).toHaveText(/Close MMU Risk/);

    await toggleBtn.click();
    await expect(page.locator('app-mmu-risk-panel')).toHaveCount(0);
    await expect(toggleBtn).toHaveText(/Open MMU Risk/);
  });

  test('no Material dialog container is created', async ({ page }) => {
    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('app-mmu-risk-panel');
    await expect(page.locator('mat-dialog-container')).toHaveCount(0);
  });

  test('renders merged columns with no duplicates', async ({ page }) => {
    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('.ag-root-wrapper');
    await page.waitForSelector('.ag-row');

    const expected = [
      'Qualified Tenor',
      'Reflex Position',
      'Adjusted Reflex Position (K units)',
      'Manual Adjustment (K Units)',
      'Target Position (K Units)',
      'Adjusted e-Position',
      'CVA Exposure (K Units)',
    ];
    for (const header of expected) {
      const escaped = header.replace(/[()]/g, '\\$&');
      await expect(
        page.locator('.ag-header-cell-text', { hasText: new RegExp(`^${escaped}$`) }),
      ).toBeVisible();
    }

    const headerCount = await page.locator('.ag-header-cell').count();
    expect(headerCount).toBe(expected.length);
  });

  test('renders rows with data merged from both sources', async ({ page }) => {
    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('.ag-row');

    const firstTenor = await page
      .locator('.ag-row[row-index="0"] .ag-cell[col-id="qualifiedTenor"]')
      .textContent();
    expect(firstTenor).toContain('Delta_O/N');

    const reflex = await page
      .locator('.ag-row[row-index="0"] .ag-cell[col-id="reflexPosition"]')
      .textContent();
    expect(reflex?.trim()).toBe('3');

    const manualAdjustment = await page
      .locator('.ag-row[row-index="0"] .ag-cell[col-id="manualAdjustment"]')
      .textContent();
    expect(manualAdjustment?.trim()).toBe('0');
  });

  test('displays multiplier, spread curves and override toggle defaults', async ({ page }) => {
    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('.ag-root-wrapper');

    await expect(page.locator('input[aria-label="Reflex Position Multiplier"]')).toHaveValue('1');
    await expect(page.locator('input[aria-label="Manual Adjustment Multiplier"]')).toHaveValue('1');
    await expect(page.locator('input[aria-label="Target Position Multiplier"]')).toHaveValue('1');
    await expect(page.locator('input[aria-label="Spread Curves"]')).toHaveValue('1M,6M,12M,OIS');

    const toggle = page.locator('button[role="switch"][aria-label*="Override source"]');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('.override-label.active', { hasText: 'Risk wins' })).toBeVisible();
  });

  test('Export Positions triggers CSV download', async ({ page }) => {
    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('.ag-row');

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export Positions")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('mmu-risk-positions.csv');
  });

  test('Refresh Risk button remains clickable after load', async ({ page }) => {
    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('.ag-row');
    const refreshRisk = page.locator('button[aria-label="Refresh Risk"]');
    await expect(refreshRisk).toBeEnabled();
    await refreshRisk.click();
    await page.waitForTimeout(400);
    await expect(refreshRisk).toBeEnabled();
  });

  test('Refresh Inputs button remains clickable after load', async ({ page }) => {
    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('.ag-row');
    const refreshInputs = page.locator('button[aria-label="Refresh Inputs"]');
    await expect(refreshInputs).toBeEnabled();
    await refreshInputs.click();
    await page.waitForTimeout(450);
    await expect(refreshInputs).toBeEnabled();
  });

  test('override toggle flips active label between Risk wins and Inputs wins', async ({ page }) => {
    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('.ag-row');

    await expect(page.locator('.override-label.active', { hasText: 'Risk wins' })).toBeVisible();

    const toggleSwitch = page.locator('button[role="switch"][aria-label*="Override source"]');
    await toggleSwitch.click();

    await expect(page.locator('.override-label.active', { hasText: 'Inputs wins' })).toBeVisible();
    await expect(toggleSwitch).toHaveAttribute('aria-checked', 'true');

    const headerCount = await page.locator('.ag-header-cell').count();
    expect(headerCount).toBe(7);
  });

  test('column order is stable across override toggle (Risk columns stay leftmost)', async ({
    page,
  }) => {
    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('.ag-row');

    const headersBefore = await page.locator('.ag-header-cell-text').allTextContents();
    expect(headersBefore.slice(0, 3)).toEqual([
      'Qualified Tenor',
      'Reflex Position',
      'Adjusted Reflex Position (K units)',
    ]);

    await page.locator('button[role="switch"][aria-label*="Override source"]').click();
    await expect(page.locator('.override-label.active', { hasText: 'Inputs wins' })).toBeVisible();

    const headersAfter = await page.locator('.ag-header-cell-text').allTextContents();
    expect(headersAfter).toEqual(headersBefore);
  });

  test('status bar shows MMU info and warning', async ({ page }) => {
    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('.ag-root-wrapper');

    const statusBar = page.locator('app-mmu-risk-status-bar');
    await expect(statusBar).toBeVisible();
    await expect(statusBar.locator('text=MMU:')).toBeVisible();
    await expect(statusBar.locator('text=Long')).toBeVisible();
    await expect(statusBar.locator('.status-warning')).toContainText(
      'Some tenors could not be matched with saved data',
    );
  });

  test('config manager column schema varies across Refresh Inputs calls', async ({ page }) => {
    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('.ag-row');

    const initialHeaders = await page.locator('.ag-header-cell-text').allTextContents();

    await page.click('button[aria-label="Refresh Inputs"]');
    await page.waitForTimeout(500);
    const secondHeaders = await page.locator('.ag-header-cell-text').allTextContents();

    expect(secondHeaders).not.toEqual(initialHeaders);

    await page.click('button[aria-label="Refresh Inputs"]');
    await page.waitForTimeout(500);
    const thirdHeaders = await page.locator('.ag-header-cell-text').allTextContents();

    expect(thirdHeaders).not.toEqual(secondHeaders);

    for (const headers of [initialHeaders, secondHeaders, thirdHeaders]) {
      expect(headers[0]).toBe('Qualified Tenor');
      expect(new Set(headers).size).toBe(headers.length);
    }

    expect(secondHeaders.length).toBe(initialHeaders.length);
    expect(thirdHeaders.length).toBe(initialHeaders.length);
  });

  test('inputs-include-risk-columns toggle marks overlapping columns as (mutual)', async ({
    page,
  }) => {
    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('.ag-row');

    const initial = await page.locator('.ag-header-cell-text').allTextContents();
    expect(initial).toContain('Reflex Position');
    expect(initial).toContain('Adjusted Reflex Position (K units)');
    expect(initial.some((h) => h.includes('(mutual)'))).toBe(false);

    const includeToggle = page.locator(
      'button[role="switch"][aria-label*="Inputs response includes risk-overlap"]',
    );
    await expect(includeToggle).toHaveAttribute('aria-checked', 'false');
    await includeToggle.click();
    await expect(includeToggle).toHaveAttribute('aria-checked', 'true');

    await page.click('button[aria-label="Refresh Inputs"]');
    await page.waitForTimeout(500);

    const afterOn = await page.locator('.ag-header-cell-text').allTextContents();
    expect(afterOn).toContain('Reflex Position (mutual)');
    expect(afterOn).toContain('Adjusted Reflex Position (K units) (mutual)');
    expect(new Set(afterOn).size).toBe(afterOn.length);

    await includeToggle.click();
    await expect(includeToggle).toHaveAttribute('aria-checked', 'false');
    await page.click('button[aria-label="Refresh Inputs"]');
    await page.waitForTimeout(500);

    const afterOff = await page.locator('.ag-header-cell-text').allTextContents();
    expect(afterOff).toContain('Reflex Position');
    expect(afterOff.some((h) => h.includes('(mutual)'))).toBe(false);
  });

  test('merged column count is stable across toggles and Refresh Inputs (no layout shift)', async ({
    page,
  }) => {
    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('.ag-row');

    const STABLE_COUNT = 7;
    const headerCount = () => page.locator('.ag-header-cell').count();

    expect(await headerCount()).toBe(STABLE_COUNT);

    // Cycle Refresh Inputs through every schema in the "without overlap" pool.
    for (let i = 0; i < 4; i++) {
      await page.click('button[aria-label="Refresh Inputs"]');
      await page.waitForTimeout(450);
      expect(await headerCount()).toBe(STABLE_COUNT);
    }

    // Turn on include-risk-columns and cycle through that pool too.
    const includeToggle = page.locator(
      'button[role="switch"][aria-label*="Inputs response includes risk-overlap"]',
    );
    await includeToggle.click();
    for (let i = 0; i < 4; i++) {
      await page.click('button[aria-label="Refresh Inputs"]');
      await page.waitForTimeout(450);
      expect(await headerCount()).toBe(STABLE_COUNT);
    }

    // Flip the override toggle as well — column count must not move.
    await page
      .locator('button[role="switch"][aria-label*="Override source"]')
      .click();
    expect(await headerCount()).toBe(STABLE_COUNT);
  });

  test('refresh buttons do not change width between idle and loading states', async ({ page }) => {
    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('.ag-row');

    const refreshRisk = page.locator('button[aria-label="Refresh Risk"]');
    const refreshInputs = page.locator('button[aria-label="Refresh Inputs"]');

    const widthOf = (locator: ReturnType<typeof page.locator>) =>
      locator.evaluate((el) => Math.round(el.getBoundingClientRect().width));

    const riskIdle = await widthOf(refreshRisk);
    const inputsIdle = await widthOf(refreshInputs);

    await refreshRisk.click();
    await expect(refreshRisk).toHaveText(/Refreshing Risk/);
    const riskLoading = await widthOf(refreshRisk);
    expect(Math.abs(riskLoading - riskIdle)).toBeLessThanOrEqual(1);

    await expect(refreshRisk).toBeEnabled();

    await refreshInputs.click();
    await expect(refreshInputs).toHaveText(/Refreshing Inputs/);
    const inputsLoading = await widthOf(refreshInputs);
    expect(Math.abs(inputsLoading - inputsIdle)).toBeLessThanOrEqual(1);
  });

  test('each refresh button has independent loading state + label flip', async ({ page }) => {
    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('.ag-row');

    const refreshRisk = page.locator('button[aria-label="Refresh Risk"]');
    const refreshInputs = page.locator('button[aria-label="Refresh Inputs"]');

    await expect(refreshRisk).toHaveText(/^\s*Refresh Risk\s*$/);
    await expect(refreshInputs).toHaveText(/^\s*Refresh Inputs\s*$/);

    await refreshRisk.click();
    await expect(refreshRisk).toBeDisabled();
    await expect(refreshRisk).toHaveText(/Refreshing Risk/);
    await expect(refreshInputs).toBeEnabled();
    await expect(refreshInputs).toHaveText(/^\s*Refresh Inputs\s*$/);

    await expect(refreshRisk).toBeEnabled();
    await expect(refreshRisk).toHaveText(/^\s*Refresh Risk\s*$/);

    await refreshInputs.click();
    await expect(refreshInputs).toBeDisabled();
    await expect(refreshInputs).toHaveText(/Refreshing Inputs/);
    await expect(refreshRisk).toBeEnabled();
    await expect(refreshRisk).toHaveText(/^\s*Refresh Risk\s*$/);
  });

  test('Refresh Risk does NOT trigger Refresh Inputs (ports are independent)', async ({
    page,
  }) => {
    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('.ag-row');

    const configOnlyFields = [
      'manualAdjustment',
      'targetPosition',
      'adjustedEPosition',
      'cvaExposure',
      'hedgeRatio',
    ];

    const readConfigHeaders = async () => {
      const all = await page.locator('.ag-header-cell-text').allTextContents();
      return all.filter((h) =>
        configOnlyFields.some((f) => h.toLowerCase().includes(f.replace(/([A-Z])/g, ' $1').toLowerCase().trim())),
      );
    };

    const readConfigCellsRow0 = async () => {
      const cells: Record<string, string> = {};
      for (const field of configOnlyFields) {
        const cell = page.locator(`.ag-row[row-index="0"] .ag-cell[col-id="${field}"]`);
        if ((await cell.count()) > 0) {
          cells[field] = (await cell.textContent())?.trim() ?? '';
        }
      }
      return cells;
    };

    const headersBefore = await readConfigHeaders();
    const cellsBefore = await readConfigCellsRow0();
    expect(headersBefore.length).toBeGreaterThan(0);
    expect(Object.keys(cellsBefore).length).toBeGreaterThan(0);

    // Hit Refresh Risk three times — if it secretly invoked Refresh Inputs,
    // the config schema pool would cycle (different header identities and
    // non-zero randomised manualAdjustment values would surface).
    for (let i = 0; i < 3; i++) {
      await page.click('button[aria-label="Refresh Risk"]');
      await page.waitForTimeout(400);
    }

    const headersAfter = await readConfigHeaders();
    const cellsAfter = await readConfigCellsRow0();

    expect(headersAfter).toEqual(headersBefore);
    expect(cellsAfter).toEqual(cellsBefore);

    // Sanity check the opposite direction: Refresh Inputs DOES change the
    // config schema pool, so after clicking it we expect at least one config
    // header or value to differ.
    await page.click('button[aria-label="Refresh Inputs"]');
    await page.waitForTimeout(500);
    const headersAfterInputs = await readConfigHeaders();
    const cellsAfterInputs = await readConfigCellsRow0();
    const somethingChanged =
      JSON.stringify(headersAfterInputs) !== JSON.stringify(headersBefore) ||
      JSON.stringify(cellsAfterInputs) !== JSON.stringify(cellsBefore);
    expect(somethingChanged).toBe(true);
  });

  test('logs a message when each button is clicked', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'log' && msg.text().includes('[mmu-risk]')) {
        logs.push(msg.text());
      }
    });

    await page.goto('/mmu-risk');
    await page.waitForSelector('button:has-text("Open MMU Risk")');
    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('.ag-row');

    await page.click('button[aria-label="Refresh Risk"]');
    await page.waitForTimeout(400);
    await page.click('button[aria-label="Refresh Inputs"]');
    await page.waitForTimeout(450);

    await page
      .locator('button[role="switch"][aria-label*="Override source"]')
      .click();
    await page
      .locator('button[role="switch"][aria-label*="Inputs response includes risk-overlap"]')
      .click();

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export Positions")');
    await downloadPromise;

    await page.click('button:has-text("Close MMU Risk")');

    const joined = logs.join('\n');
    expect(joined).toContain('[mmu-risk] Open MMU Risk clicked');
    expect(joined).toContain('[mmu-risk] Refresh Risk clicked');
    expect(joined).toContain('[mmu-risk] Refresh Inputs clicked');
    expect(joined).toContain('[mmu-risk] Override toggle changed');
    expect(joined).toContain('[mmu-risk] Include risk columns toggle changed');
    expect(joined).toContain('[mmu-risk] Export Positions clicked');
    expect(joined).toContain('[mmu-risk] Close MMU Risk clicked');
  });

  test('state is preserved across close/reopen', async ({ page }) => {
    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('.ag-row');

    await page.locator('button[role="switch"][aria-label*="Override source"]').click();
    await expect(page.locator('.override-label.active', { hasText: 'Inputs wins' })).toBeVisible();

    await page.click('button:has-text("Close MMU Risk")');
    await expect(page.locator('app-mmu-risk-panel')).toHaveCount(0);

    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('app-mmu-risk-panel');
    await expect(page.locator('.override-label.active', { hasText: 'Inputs wins' })).toBeVisible();
  });
});
