import { describe, expect, it } from 'vitest';
import type { PositionTargetItem, RiskItem } from '../models/model';
import { mergeRows } from './mmu-risk.store';

function target(tenor: string, overrides: Partial<PositionTargetItem> = {}): PositionTargetItem {
  return {
    tenor,
    reflexPosition: 0,
    manualAdjustment: 0,
    targetPosition: 0,
    ...overrides,
  };
}

describe('mergeRows', () => {
  it('returns empty when risk is empty', () => {
    expect(mergeRows([], [target('anything')])).toEqual([]);
  });

  it('tenors come from risk only — inputs-only tenors are dropped', () => {
    const risk: RiskItem[] = [{ tenor: '1M', value: 10 }];
    const targets = [target('6M', { manualAdjustment: 99, targetPosition: 55 })];
    const out = mergeRows(risk, targets);
    expect(out.map((r) => r.tenor)).toEqual(['1M']);
  });

  it('preserves risk tenor ordering', () => {
    const risk: RiskItem[] = [
      { tenor: '1M', value: 1 },
      { tenor: '3M', value: 3 },
      { tenor: '6M', value: 6 },
    ];
    expect(mergeRows(risk, []).map((r) => r.tenor)).toEqual(['1M', '3M', '6M']);
  });

  it('uses risk value for reflexPosition always', () => {
    const risk: RiskItem[] = [{ tenor: '1M', value: 10 }];
    const targets = [target('1M', { reflexPosition: 999 })];
    expect(mergeRows(risk, targets)[0].reflexPosition).toBe(10);
  });

  it('uses 0 defaults for manual + target when tenor absent from inputs', () => {
    const risk: RiskItem[] = [{ tenor: 'NEW', value: 42 }];
    expect(mergeRows(risk, [])).toEqual([
      { tenor: 'NEW', reflexPosition: 42, manualAdjustment: 0, targetPosition: 0 },
    ]);
  });

  it('pulls manual + target from inputs when tenor matches', () => {
    const risk: RiskItem[] = [{ tenor: '1M', value: 10 }];
    const targets = [target('1M', { manualAdjustment: 5, targetPosition: 15 })];
    expect(mergeRows(risk, targets)[0]).toEqual({
      tenor: '1M',
      reflexPosition: 10,
      manualAdjustment: 5,
      targetPosition: 15,
    });
  });
});
