import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

type MockControl = {
  failNext: Partial<Record<'getUserMappings' | 'getRisk' | 'getInputs' | 'exportPositions', string | null>>;
  emptyRiskNext: boolean;
};

async function installMockControl(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __mmuRiskMockControl: MockControl }).__mmuRiskMockControl = {
      failNext: {},
      emptyRiskNext: false,
    };
  });
}

async function setNextFailure(
  page: Page,
  endpoint: keyof MockControl['failNext'],
  message: string,
): Promise<void> {
  await page.evaluate(
    ({ endpoint, message }) => {
      const w = window as unknown as { __mmuRiskMockControl: MockControl };
      w.__mmuRiskMockControl.failNext[endpoint as keyof MockControl['failNext']] = message;
    },
    { endpoint, message },
  );
}

async function setEmptyRiskNext(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __mmuRiskMockControl: MockControl };
    w.__mmuRiskMockControl.emptyRiskNext = true;
  });
}

async function gotoMmuRisk(page: Page): Promise<void> {
  await installMockControl(page);
  await page.goto('/mmu-risk');
  await page.waitForSelector('button:has-text("Open MMU Risk")');
}

async function openDialogAndSelect(page: Page, mmuName: string): Promise<void> {
  await page.click('button:has-text("Open MMU Risk")');
  await page.waitForSelector('mat-dialog-container');
  await page.locator('mat-dialog-container mat-select').click();
  await page.locator('mat-option', { hasText: mmuName }).click();
  await page.click('mat-dialog-container button[aria-label="Proceed with selected MMU"]');
  await page.waitForSelector('mat-dialog-container', { state: 'detached' });
  await page.waitForSelector('app-mmu-risk-panel');
}

test.describe('MMU Risk — dialog error + retry', () => {
  test('shows error message + Retry button when getUserMappings fails, then recovers', async ({
    page,
  }) => {
    await gotoMmuRisk(page);
    await setNextFailure(page, 'getUserMappings', 'Simulated mappings failure');

    await page.click('button:has-text("Open MMU Risk")');
    await expect(page.locator('mat-dialog-container p[role="alert"]')).toContainText(
      'Failed to load MMU list',
    );
    await expect(page.locator('mat-dialog-container p[role="alert"]')).toContainText(
      'Simulated mappings failure',
    );

    // Retry — next call succeeds (no failure queued)
    await page.click('mat-dialog-container button:has-text("Retry")');
    await expect(page.locator('mat-dialog-container mat-select')).toBeVisible();
  });
});

test.describe('MMU Risk — empty valid response', () => {
  test('shows empty placeholder when Risk returns zero rows (tenors come from Risk)', async ({
    page,
  }) => {
    await gotoMmuRisk(page);
    await setEmptyRiskNext(page);

    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('mat-dialog-container');
    await page.locator('mat-dialog-container mat-select').click();
    await page.locator('mat-option', { hasText: 'EUR_SWAP_DESK' }).click();
    await page.click('mat-dialog-container button[aria-label="Proceed with selected MMU"]');
    await page.waitForSelector('mat-dialog-container', { state: 'detached' });
    await page.waitForSelector('app-mmu-risk-panel');

    // Wait for the empty placeholder — grid should NOT render because Risk is empty.
    await expect(page.locator('.empty-placeholder')).toBeVisible();
    await expect(page.locator('.loading-placeholder')).toHaveCount(0);
    await expect(page.locator('.ag-row')).toHaveCount(0);
  });
});

test.describe('MMU Risk — race condition guard', () => {
  test('switching MMU before first Risk resolves does not leave stale data from the first', async ({
    page,
  }) => {
    await gotoMmuRisk(page);

    // Select A
    await openDialogAndSelect(page, 'EUR_SWAP_DESK');

    // While A is rendered, Close + switch to B quickly
    await page.click('button:has-text("Close MMU Risk")');
    await expect(page.locator('app-mmu-risk-panel')).toHaveCount(0);

    await openDialogAndSelect(page, 'USD_RATES_DESK');

    // Header must reflect B, not A, even if A's response lands late
    await expect(page.locator('#mmu-risk-panel-title')).toContainText('USD_RATES_DESK');
    await page.waitForTimeout(800); // allow any stale-in-flight to attempt patch
    await expect(page.locator('#mmu-risk-panel-title')).toContainText('USD_RATES_DESK');
  });
});

test.describe('MMU Risk — export banner dismiss', () => {
  test('dismiss button clears the success banner', async ({ page }) => {
    await gotoMmuRisk(page);
    await openDialogAndSelect(page, 'EUR_SWAP_DESK');

    await page.click('button[aria-label="Export Positions"]');
    const banner = page.locator('.export-banner.success');
    await expect(banner).toBeVisible();
    await banner.locator('button[aria-label="Dismiss export message"]').click();
    await expect(banner).toHaveCount(0);
  });

  test('error banner shows server message when export fails', async ({ page }) => {
    await gotoMmuRisk(page);
    await openDialogAndSelect(page, 'EUR_SWAP_DESK');
    await setNextFailure(page, 'exportPositions', 'Upstream rejected');

    await page.click('button[aria-label="Export Positions"]');
    const banner = page.locator('.export-banner.error');
    await expect(banner).toContainText('Upstream rejected');
  });
});

test.describe('MMU Risk — accessibility (axe)', () => {
  test('selector dialog has no critical a11y violations', async ({ page }) => {
    await gotoMmuRisk(page);
    await page.click('button:has-text("Open MMU Risk")');
    await page.waitForSelector('mat-dialog-container mat-select');

    const results = await new AxeBuilder({ page })
      .include('mat-dialog-container')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toEqual([]);
  });

  test('panel after MMU selection has no critical a11y violations', async ({ page }) => {
    await gotoMmuRisk(page);
    await openDialogAndSelect(page, 'EUR_SWAP_DESK');
    await page.waitForSelector('.ag-row');

    const results = await new AxeBuilder({ page })
      .include('app-mmu-risk-panel')
      // AG Grid ships with some known non-fixable serious issues around .ag-cell roles.
      // Filter them so we don't block on third-party markup while still catching ours.
      .disableRules(['aria-required-children', 'aria-required-parent', 'nested-interactive'])
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical');
    expect(critical).toEqual([]);
  });
});
