import type { ColumnMeta } from '../../models/mmu-risk.model';

/**
 * Catalog of every column the Config Manager mock knows how to emit.
 * Schemas reference these by field name.
 */
export const CONFIG_MANAGER_COLUMN_CATALOG: Readonly<Record<string, ColumnMeta>> = {
  qualifiedTenor: {
    field: 'qualifiedTenor',
    headerName: 'Qualified Tenor',
    type: 'text',
    source: 'inputs',
  },
  manualAdjustment: {
    field: 'manualAdjustment',
    headerName: 'Manual Adjustment (K Units)',
    type: 'numeric',
    editable: true,
    source: 'inputs',
  },
  reflexPosition: {
    field: 'reflexPosition',
    headerName: 'Reflex Position',
    type: 'numeric',
    source: 'inputs',
  },
  adjustedReflexPosition: {
    field: 'adjustedReflexPosition',
    headerName: 'Adjusted Reflex Position (K units)',
    type: 'numeric',
    source: 'inputs',
  },
  targetPosition: {
    field: 'targetPosition',
    headerName: 'Target Position (K Units)',
    type: 'numeric',
    source: 'inputs',
  },
  adjustedEPosition: {
    field: 'adjustedEPosition',
    headerName: 'Adjusted e-Position',
    type: 'numeric',
    source: 'inputs',
  },
  cvaExposure: {
    field: 'cvaExposure',
    headerName: 'CVA Exposure (K Units)',
    type: 'numeric',
    source: 'inputs',
  },
  hedgeRatio: {
    field: 'hedgeRatio',
    headerName: 'Hedge Ratio',
    type: 'numeric',
    source: 'inputs',
  },
};
