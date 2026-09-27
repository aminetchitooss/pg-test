import { ColumnState, IAggFunc, IRowNode } from 'ag-grid-community';

export const DefaultColumnAggregation = 'Sum' as const;
export type ColumnAggregation = typeof DefaultColumnAggregation | 'Avg';

export interface ColumnAggregationConfig {
  key: string;
  value: ColumnAggregation;
}

const LEAF_AVG = 'leafAvg';

const COLUMN_AGG_FUNCS: Record<ColumnAggregation, string> = { Sum: 'sum', Avg: LEAF_AVG };

export const COLUMN_AGGREGATIONS = Object.keys(COLUMN_AGG_FUNCS) as ColumnAggregation[];

export function aggFuncFor(aggregation?: string): string {
  const name = aggregation?.trim().toLowerCase();
  const match = COLUMN_AGGREGATIONS.find((a) => a.toLowerCase() === name);
  return COLUMN_AGG_FUNCS[match ?? DefaultColumnAggregation];
}

export function withoutAggFunc(state: ColumnState[]): ColumnState[] {
  return state.map(({ aggFunc: _aggFunc, ...rest }) => rest);
}

export function createAggFuncs(): Record<string, IAggFunc> {
  return { [LEAF_AVG]: createLeafAvg() };
}

function createLeafAvg(): IAggFunc {
  const totalsByColumn = new Map<string, WeakMap<IRowNode, { sum: number; count: number }>>();

  return ({ rowNode, values, column }) => {
    const colId = column.getColId();
    let totals = totalsByColumn.get(colId);
    if (!totals) totalsByColumn.set(colId, (totals = new WeakMap()));

    const children =
      rowNode.childrenAfterFilter?.length === values.length
        ? rowNode.childrenAfterFilter
        : rowNode.childrenAfterGroup;

    let sum = 0;
    let count = 0;
    for (let i = 0; i < values.length; i++) {
      const child = children?.[i];
      const childTotal = child?.group && totals.get(child);
      if (childTotal) {
        sum += childTotal.sum;
        count += childTotal.count;
      } else if (Number.isFinite(values[i])) {
        sum += values[i];
        count++;
      }
    }

    totals.set(rowNode, { sum, count });
    return count ? sum / count : null;
  };
}
