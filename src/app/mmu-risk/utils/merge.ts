import type { ColumnMeta, DataRow, OverrideSource } from '../models/mmu-risk.model';

const KEY_FIELD = 'qualifiedTenor';

export const MUTUAL_SUFFIX = ' (mutual)';

export function mergeColumns(
  riskColumns: readonly ColumnMeta[],
  configColumns: readonly ColumnMeta[],
): ColumnMeta[] {
  const byField = new Map<string, ColumnMeta>();
  const configFields = new Set(configColumns.map((c) => c.field));

  const pinned =
    riskColumns.find((c) => c.field === KEY_FIELD) ??
    configColumns.find((c) => c.field === KEY_FIELD);
  if (pinned) byField.set(KEY_FIELD, pinned);

  for (const col of riskColumns) {
    if (col.field === KEY_FIELD) continue;
    const isMutual = configFields.has(col.field);
    byField.set(
      col.field,
      isMutual ? { ...col, headerName: `${col.headerName}${MUTUAL_SUFFIX}` } : col,
    );
  }
  for (const col of configColumns) {
    if (col.field === KEY_FIELD) continue;
    if (!byField.has(col.field)) byField.set(col.field, col);
  }

  return [...byField.values()];
}

export function mergeRows(
  riskRows: readonly DataRow[],
  configRows: readonly DataRow[],
  mergedColumns: readonly ColumnMeta[],
  override: OverrideSource,
): DataRow[] {
  const riskByTenor = new Map(riskRows.map((r) => [r.qualifiedTenor, r]));
  const configByTenor = new Map(configRows.map((r) => [r.qualifiedTenor, r]));

  const orderedTenors: string[] = [];
  const seen = new Set<string>();
  for (const r of riskRows) {
    if (!seen.has(r.qualifiedTenor)) {
      orderedTenors.push(r.qualifiedTenor);
      seen.add(r.qualifiedTenor);
    }
  }
  for (const r of configRows) {
    if (!seen.has(r.qualifiedTenor)) {
      orderedTenors.push(r.qualifiedTenor);
      seen.add(r.qualifiedTenor);
    }
  }

  return orderedTenors.map((tenor) => {
    const risk = riskByTenor.get(tenor);
    const config = configByTenor.get(tenor);
    const primary = override === 'risk' ? risk : config;
    const secondary = override === 'risk' ? config : risk;

    const merged: DataRow = { qualifiedTenor: tenor };
    for (const col of mergedColumns) {
      if (col.field === KEY_FIELD) continue;
      const pVal = primary?.[col.field];
      const sVal = secondary?.[col.field];
      merged[col.field] = pVal !== undefined ? pVal : sVal !== undefined ? sVal : null;
    }
    return merged;
  });
}
