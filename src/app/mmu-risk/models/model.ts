export interface ReportV4Request {
  jsonrpc: '2.0';
  id: string;
  method: 'report_v4';
  params: unknown[];
}

export interface RiskItem {
  tenor: string;
  value: number;
}

// Domain PositionTargetItem holds only the source fields.
// Adjusted fields are computed on display and on export (see mapper).
export interface PositionTargetItem {
  tenor: string;
  reflexPosition: number;
  manualAdjustment: number;
  targetPosition: number;
}

export interface InventoryItem {
  rollingFamily: string;
  sodPosition: number;
  sodPvPv01: number;
  newPosition: number;
  newPv01: number;
}

export interface MmuUserMappingsResult {
  mmuNames: string[];
  spreadCurves?: string[];
}

export interface MmuRiskResult {
  spreadCurves: string[];
  snapshotTime: Date;
  risk: RiskItem[];
  inventory: InventoryItem[];
}

export interface MmuInputsResult {
  mmuName: string;
  lastPublishTime: Date;
  lastPublishedBy: string;
  comment: string;
  positionTargets: PositionTargetItem[];
}

export interface ExportPositionsResult {
  success: boolean;
  error: string;
}

export interface MmuMultipliers {
  reflexPositionMultiplier: number;
  manualAdjustmentMultiplier: number;
  targetPositionMultiplier: number;
}

export interface MergedRow {
  tenor: string;
  reflexPosition: number;
  manualAdjustment: number;
  targetPosition: number;
}

export type EditableMergedRowField = 'manualAdjustment' | 'targetPosition';
