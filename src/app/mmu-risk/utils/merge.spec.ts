import { describe, it, expect } from 'vitest';
import { mergeColumns, mergeRows } from './merge';
import type { ColumnMeta, DataRow } from '../models/mmu-risk.model';

const riskColumns: ColumnMeta[] = [
  { field: 'qualifiedTenor', headerName: 'Qualified Tenor', type: 'text', source: 'risk' },
  { field: 'reflexPosition', headerName: 'Reflex Position', type: 'numeric', source: 'risk' },
  {
    field: 'adjustedReflexPosition',
    headerName: 'Adjusted Reflex Position [Risk]',
    type: 'numeric',
    source: 'risk',
  },
];

const configColumns: ColumnMeta[] = [
  { field: 'qualifiedTenor', headerName: 'Qualified Tenor', type: 'text', source: 'inputs' },
  {
    field: 'manualAdjustment',
    headerName: 'Manual Adjustment (K Units)',
    type: 'numeric',
    editable: true,
    source: 'inputs',
  },
  {
    field: 'adjustedReflexPosition',
    headerName: 'Adjusted Reflex Position [Inputs]',
    type: 'numeric',
    source: 'inputs',
  },
  { field: 'targetPosition', headerName: 'Target Position (K Units)', type: 'numeric', source: 'inputs' },
];

const riskRows: DataRow[] = [
  { qualifiedTenor: 'Delta_O/N', reflexPosition: 3, adjustedReflexPosition: 3 },
  { qualifiedTenor: 'Delta_T/N', reflexPosition: 1, adjustedReflexPosition: 1 },
];

const configRows: DataRow[] = [
  { qualifiedTenor: 'Delta_O/N', manualAdjustment: 10, adjustedReflexPosition: 13, targetPosition: 0 },
  { qualifiedTenor: 'Delta_T/N', manualAdjustment: 5, adjustedReflexPosition: 6, targetPosition: 0 },
  { qualifiedTenor: 'Delta_D:06-MAY-2026', manualAdjustment: 0, adjustedReflexPosition: 13, targetPosition: 0 },
];

describe('mergeColumns', () => {
  it('pins Qualified Tenor first', () => {
    const merged = mergeColumns(riskColumns, configColumns);
    expect(merged[0].field).toBe('qualifiedTenor');
  });

  it('keeps risk definition and marks overlapping columns as mutual in the header', () => {
    const merged = mergeColumns(riskColumns, configColumns);
    const adjusted = merged.find((c) => c.field === 'adjustedReflexPosition');
    expect(adjusted?.source).toBe('risk');
    expect(adjusted?.headerName).toBe('Adjusted Reflex Position [Risk] (mutual)');
  });

  it('does NOT append (mutual) to non-overlapping columns', () => {
    const merged = mergeColumns(riskColumns, configColumns);
    const reflex = merged.find((c) => c.field === 'reflexPosition');
    const manual = merged.find((c) => c.field === 'manualAdjustment');
    expect(reflex?.headerName).toBe('Reflex Position');
    expect(manual?.headerName).toBe('Manual Adjustment (K Units)');
  });

  it('orders risk columns before inputs-only columns', () => {
    const merged = mergeColumns(riskColumns, configColumns);
    const fields = merged.map((c) => c.field);
    expect(fields).toEqual([
      'qualifiedTenor',
      'reflexPosition',
      'adjustedReflexPosition',
      'manualAdjustment',
      'targetPosition',
    ]);
  });

  it('includes non-overlapping columns from both sources', () => {
    const merged = mergeColumns(riskColumns, configColumns);
    const fields = merged.map((c) => c.field);
    expect(fields).toContain('reflexPosition');
    expect(fields).toContain('manualAdjustment');
    expect(fields).toContain('targetPosition');
  });

  it('produces no duplicate fields', () => {
    const merged = mergeColumns(riskColumns, configColumns);
    const fields = merged.map((c) => c.field);
    expect(new Set(fields).size).toBe(fields.length);
  });
});

describe('mergeRows', () => {
  it('risk value wins on overlapping field when override=risk', () => {
    const cols = mergeColumns(riskColumns, configColumns);
    const rows = mergeRows(riskRows, configRows, cols, 'risk');
    const on = rows.find((r) => r.qualifiedTenor === 'Delta_O/N');
    expect(on?.['adjustedReflexPosition']).toBe(3);
  });

  it('inputs value wins on overlapping field when override=inputs', () => {
    const cols = mergeColumns(riskColumns, configColumns);
    const rows = mergeRows(riskRows, configRows, cols, 'inputs');
    const on = rows.find((r) => r.qualifiedTenor === 'Delta_O/N');
    expect(on?.['adjustedReflexPosition']).toBe(13);
  });

  it('falls back to the other source when primary has no value', () => {
    const cols = mergeColumns(riskColumns, configColumns);
    const rows = mergeRows(riskRows, configRows, cols, 'risk');
    const on = rows.find((r) => r.qualifiedTenor === 'Delta_O/N');
    expect(on?.['manualAdjustment']).toBe(10);
  });

  it('includes tenors unique to either source', () => {
    const cols = mergeColumns(riskColumns, configColumns);
    const rows = mergeRows(riskRows, configRows, cols, 'risk');
    expect(rows.map((r) => r.qualifiedTenor)).toContain('Delta_D:06-MAY-2026');
  });
});
