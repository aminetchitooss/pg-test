import { describe, expect, it } from 'vitest';
import type { PositionTargetItem, RiskItem } from '../contracts/model';
import { mergeRows } from './mmu-risk.store';

function target(tenor: string, overrides: Partial<PositionTargetItem> = {}): PositionTargetItem {
  return {
    tenor,
    reflexPosition: 0,
    manualAdjustment: 0,
    adjustedReflexPosition: 0,
    targetPosition: 0,
    adjustedEPosition: 0,
    ...overrides,
  };
}

describe('mergeRows', () => {
  it('returns empty when both inputs are empty', () => {
    expect(mergeRows([], [], 'risk')).toEqual([]);
  });

  it('includes risk-only tenors with positionTarget fields = null', () => {
    const risk: RiskItem[] = [{ tenor: '1M', value: 10 }];
    const [row] = mergeRows(risk, [], 'risk');
    expect(row).toEqual({
      tenor: '1M',
      reflexPosition: 10,
      manualAdjustment: null,
      adjustedReflexPosition: null,
      targetPosition: null,
      adjustedEPosition: null,
    });
  });

  it('includes input-only tenors with reflexPosition falling back to PositionTargetItem.reflexPosition', () => {
    const [row] = mergeRows([], [target('6M', { reflexPosition: 77 })], 'risk');
    expect(row.reflexPosition).toBe(77);
  });

  it('with override=risk, keeps the Risk.value for reflexPosition even when inputs also has one', () => {
    const risk: RiskItem[] = [{ tenor: '1M', value: 10 }];
    const inputs = [target('1M', { reflexPosition: 99 })];
    const [row] = mergeRows(risk, inputs, 'risk');
    expect(row.reflexPosition).toBe(10);
  });

  it('with override=inputs, replaces reflexPosition with PositionTargetItem.reflexPosition', () => {
    const risk: RiskItem[] = [{ tenor: '1M', value: 10 }];
    const inputs = [target('1M', { reflexPosition: 99 })];
    const [row] = mergeRows(risk, inputs, 'inputs');
    expect(row.reflexPosition).toBe(99);
  });

  it('preserves order: risk tenors first, then input-only tenors', () => {
    const risk: RiskItem[] = [{ tenor: '1M', value: 1 }];
    const inputs = [target('1M'), target('6M'), target('12M')];
    expect(mergeRows(risk, inputs, 'risk').map((r) => r.tenor)).toEqual(['1M', '6M', '12M']);
  });

  it('copies all PositionTargetItem fields into the row', () => {
    const [row] = mergeRows(
      [],
      [
        target('1M', {
          manualAdjustment: 5,
          adjustedReflexPosition: 105,
          targetPosition: 110,
          adjustedEPosition: 108,
        }),
      ],
      'risk',
    );
    expect(row).toMatchObject({
      manualAdjustment: 5,
      adjustedReflexPosition: 105,
      targetPosition: 110,
      adjustedEPosition: 108,
    });
  });
});
