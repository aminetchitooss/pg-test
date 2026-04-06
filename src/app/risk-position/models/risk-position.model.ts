export interface RiskPositionRow {
  qualifiedTenor: string;
  [key: string]: string | number;
}

export interface RiskPositionColumnMeta {
  field: string;
  headerName: string;
  editable?: boolean;
  type: 'text' | 'numeric';
}

export interface RiskPositionApiResponse {
  columns: RiskPositionColumnMeta[];
  rows: RiskPositionRow[];
  status: RiskPositionStatus;
}

export interface RiskPositionStatus {
  mmuDirection: 'Long' | 'Short' | 'Flat';
  snapshotTime: string;
  lastPublishTime: string;
  lastPublishedBy: string;
  comment: string;
}

export interface RiskPositionMultipliers {
  reflexPositionMultiplier: number;
  manualAdjustmentMultiplier: number;
  targetPositionMultiplier: number;
}

export type RiskViewType = 'risk-position' | 'pnl-attribution';

export interface RiskPositionDialogData {
  viewType: RiskViewType;
}
