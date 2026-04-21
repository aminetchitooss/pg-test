export interface MmuUserMappingsRequestDto {
  RequestId: string;
  UserId: string;
}

export interface MmuUserMappingsResponseDto {
  RequestId: string;
  MmuNames: string[];
  SpreadCurves?: string[];
}

export interface MmuRiskRequestDto {
  RequestId: string;
  MmuName: string;
  SpreadCurves: string[];
  ReportV4Request: string;
}

export interface MmuRiskResponseDto {
  RequestId: string;
  SpreadCurves: string[];
  SnapshotTime: string;
  Risk: RiskItemDto[];
  Inventory: InventoryItemDto[];
}

export interface MmuInputsRequestDto {
  RequestId: string;
  MmuName: string;
}

export interface MmuInputsResponseDto {
  RequestId: string;
  MmuName: string;
  LastPublishTime: string;
  LastPublishedBy: string;
  Comment: string;
  PositionTargets: PositionTargetItemDto[];
}

export interface ExportPositionsRequestDto {
  RequestId: string;
  MmuName: string;
  UserId: string;
  Inventory: InventoryItemDto[];
  PositionTargets: PositionTargetItemDto[];
}

export interface ExportPositionsResponseDto {
  Success: string;
  Error: string;
}

export interface RiskItemDto {
  Tenor: string;
  Value: string;
}

export interface PositionTargetItemDto {
  Tenor: string;
  ReflexPosition: string;
  ManualAdjustment: string;
  AdjustedReflexPosition: string;
  TargetPosition: string;
  AdjustedEPosition: string;
}

export interface InventoryItemDto {
  RollingFamily: string;
  SodPosition: string;
  SodPvPv01: string;
  NewPosition: string;
  NewPv01: string;
}
