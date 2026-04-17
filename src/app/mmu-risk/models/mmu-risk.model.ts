export type ColumnSource = 'risk' | 'inputs';

export type OverrideSource = ColumnSource;

export interface ColumnMeta {
  field: string;
  headerName: string;
  type: 'text' | 'numeric';
  editable?: boolean;
  source: ColumnSource;
}

export interface DataRow {
  qualifiedTenor: string;
  [key: string]: string | number | null;
}

export interface MmuStatus {
  mmuDirection: 'Long' | 'Short' | 'Flat';
  snapshotTime: string;
  lastPublishTime: string;
  lastPublishedBy: string;
  comment: string;
  warnings: string[];
}

export interface MmuMultipliers {
  reflexPositionMultiplier: number;
  manualAdjustmentMultiplier: number;
  targetPositionMultiplier: number;
}

export interface RiskApiResponse {
  columns: ColumnMeta[];
  rows: DataRow[];
  status: MmuStatus;
}

export interface ConfigManagerApiResponse {
  columns: ColumnMeta[];
  rows: DataRow[];
}
