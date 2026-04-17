import type { ColumnMeta } from '../../models/mmu-risk.model';

export const RISK_COLUMNS: readonly ColumnMeta[] = [
  { field: 'qualifiedTenor', headerName: 'Qualified Tenor', type: 'text', source: 'risk' },
  { field: 'reflexPosition', headerName: 'Reflex Position', type: 'numeric', source: 'risk' },
  {
    field: 'adjustedReflexPosition',
    headerName: 'Adjusted Reflex Position (K units)',
    type: 'numeric',
    source: 'risk',
  },
];

export const RISK_STATUS_DEFAULTS = {
  mmuDirection: 'Long' as const,
  lastPublishTime: '27 Nov, 14:35:29 [2879:15:42 since last update]',
  lastPublishedBy: 'f13920',
  comment: 'Reflex Publish',
  warnings: ['Some tenors could not be matched with saved data'],
};
