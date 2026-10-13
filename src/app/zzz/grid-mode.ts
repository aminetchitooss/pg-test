import { GridOptions } from 'ag-grid-community';

/**
 * How a grid lays a report out:
 * - `pivot`: the dimensions are row groups, values are aggregated per group.
 * - `flat`: every dimension is a plain column and every record is its own row.
 */
export const GRID_MODE = {
  PIVOT: 'pivot',
  FLAT: 'flat',
} as const;

export type GridMode = (typeof GRID_MODE)[keyof typeof GRID_MODE];

/** The mode a grid starts in, and what an unset saved mode means. */
export const DEFAULT_GRID_MODE: GridMode = GRID_MODE.PIVOT;

/** Every mode, in the order the picker lists them. */
export const GRID_MODES: readonly GridMode[] = [GRID_MODE.PIVOT, GRID_MODE.FLAT];

export const GRID_MODE_LABELS: Readonly<Record<GridMode, string>> = {
  [GRID_MODE.PIVOT]: 'Pivot grid',
  [GRID_MODE.FLAT]: 'Flat grid',
};

/** Material Icons ligature per mode — what the toolbar button shows for it. */
export const GRID_MODE_ICONS: Readonly<Record<GridMode, string>> = {
  [GRID_MODE.PIVOT]: 'pivot_table_chart',
  [GRID_MODE.FLAT]: 'table_rows',
};

export type RowGroupPanelShow = NonNullable<GridOptions['rowGroupPanelShow']>;

/**
 * Which modes show ag-grid's "drag here to set row groups" panel. Flat only by
 * default: pivot already groups by every dimension, so there it would just be a
 * row of pills. Override per grid through GridModeGridDirective's `rowGroupPanel`.
 * ::ng-deep .credit-grid .ag-advanced-filter-header {
  height: auto !important;
  min-height: 0 !important;
  // The slot is a flex item between the header and the body. Without this, the
  // body (100k rows) shrinks it to 1px and the bar paints over the header and
  // first row - which also swallows every header drag (ag-grid >= 34.3).
  flex: 0 0 auto !important;
  padding: 0;
  background-color: transparent;
}
 */
export const GRID_MODE_ROW_GROUP_PANEL: Readonly<Record<GridMode, RowGroupPanelShow>> = {
  [GRID_MODE.PIVOT]: 'never',
  [GRID_MODE.FLAT]: 'always',
};

/** Class GridModeGridDirective puts on the grid element while it is flat. */
export const FLAT_GRID_CLASS = 'is-flat-grid';
