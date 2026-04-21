import type {
  ExportPositionsRequestDto,
  ExportPositionsResponseDto,
  InventoryItemDto,
  MmuInputsRequestDto,
  MmuInputsResponseDto,
  MmuRiskRequestDto,
  MmuRiskResponseDto,
  MmuUserMappingsRequestDto,
  MmuUserMappingsResponseDto,
  PositionTargetItemDto,
  RiskItemDto,
} from './dto';
import type {
  ExportPositionsResult,
  InventoryItem,
  MmuInputsResult,
  MmuRiskResult,
  MmuUserMappingsResult,
  PositionTargetItem,
  ReportV4Request,
  RiskItem,
} from './model';

export class MapperError extends Error {
  constructor(message: string) {
    super(`[mmu-risk mapper] ${message}`);
    this.name = 'MapperError';
  }
}

function parseNumber(value: unknown, field: string): number {
  if (value === null || value === undefined) {
    throw new MapperError(`expected finite number for "${field}", got ${JSON.stringify(value)}`);
  }
  if (typeof value === 'string' && value.trim() === '') {
    throw new MapperError(`expected finite number for "${field}", got empty string`);
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new MapperError(`expected finite number for "${field}", got ${JSON.stringify(value)}`);
  }
  return n;
}

function parseDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new MapperError(`expected ISO-8601 date for "${field}", got ${JSON.stringify(value)}`);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new MapperError(`expected ISO-8601 date for "${field}", got ${JSON.stringify(value)}`);
  }
  return d;
}

function parseBool(value: unknown, field: string): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new MapperError(`expected "true"|"false" for "${field}", got ${JSON.stringify(value)}`);
}

function numberToDto(value: number, field: string): string {
  if (!Number.isFinite(value)) {
    throw new MapperError(`cannot serialize non-finite number for "${field}", got ${value}`);
  }
  return String(value);
}

function safeJsonStringify(value: unknown, field: string): string {
  try {
    return JSON.stringify(value);
  } catch (err) {
    throw new MapperError(
      `failed to JSON.stringify "${field}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function riskItemFromDto(dto: RiskItemDto): RiskItem {
  return { tenor: dto.Tenor, value: parseNumber(dto.Value, 'RiskItem.Value') };
}

export function positionTargetFromDto(dto: PositionTargetItemDto): PositionTargetItem {
  return {
    tenor: dto.Tenor,
    reflexPosition: parseNumber(dto.ReflexPosition, 'PositionTargetItem.ReflexPosition'),
    manualAdjustment: parseNumber(dto.ManualAdjustment, 'PositionTargetItem.ManualAdjustment'),
    adjustedReflexPosition: parseNumber(
      dto.AdjustedReflexPosition,
      'PositionTargetItem.AdjustedReflexPosition',
    ),
    targetPosition: parseNumber(dto.TargetPosition, 'PositionTargetItem.TargetPosition'),
    adjustedEPosition: parseNumber(dto.AdjustedEPosition, 'PositionTargetItem.AdjustedEPosition'),
  };
}

export function inventoryItemFromDto(dto: InventoryItemDto): InventoryItem {
  return {
    rollingFamily: dto.RollingFamily,
    sodPosition: parseNumber(dto.SodPosition, 'InventoryItem.SodPosition'),
    sodPvPv01: parseNumber(dto.SodPvPv01, 'InventoryItem.SodPvPv01'),
    newPosition: parseNumber(dto.NewPosition, 'InventoryItem.NewPosition'),
    newPv01: parseNumber(dto.NewPv01, 'InventoryItem.NewPv01'),
  };
}

export function userMappingsFromDto(dto: MmuUserMappingsResponseDto): MmuUserMappingsResult {
  return { mmuNames: dto.MmuNames, spreadCurves: dto.SpreadCurves };
}

export function riskResponseFromDto(dto: MmuRiskResponseDto): MmuRiskResult {
  return {
    spreadCurves: dto.SpreadCurves,
    snapshotTime: parseDate(dto.SnapshotTime, 'MmuRiskResponse.SnapshotTime'),
    risk: dto.Risk.map(riskItemFromDto),
    inventory: dto.Inventory.map(inventoryItemFromDto),
  };
}

export function inputsResponseFromDto(dto: MmuInputsResponseDto): MmuInputsResult {
  return {
    mmuName: dto.MmuName,
    lastPublishTime: parseDate(dto.LastPublishTime, 'MmuInputsResponse.LastPublishTime'),
    lastPublishedBy: dto.LastPublishedBy,
    comment: dto.Comment,
    positionTargets: dto.PositionTargets.map(positionTargetFromDto),
  };
}

export function exportResponseFromDto(dto: ExportPositionsResponseDto): ExportPositionsResult {
  return { success: parseBool(dto.Success, 'ExportPositionsResponse.Success'), error: dto.Error };
}

export function positionTargetToDto(item: PositionTargetItem): PositionTargetItemDto {
  return {
    Tenor: item.tenor,
    ReflexPosition: numberToDto(item.reflexPosition, 'PositionTargetItem.reflexPosition'),
    ManualAdjustment: numberToDto(item.manualAdjustment, 'PositionTargetItem.manualAdjustment'),
    AdjustedReflexPosition: numberToDto(
      item.adjustedReflexPosition,
      'PositionTargetItem.adjustedReflexPosition',
    ),
    TargetPosition: numberToDto(item.targetPosition, 'PositionTargetItem.targetPosition'),
    AdjustedEPosition: numberToDto(item.adjustedEPosition, 'PositionTargetItem.adjustedEPosition'),
  };
}

export function inventoryItemToDto(item: InventoryItem): InventoryItemDto {
  return {
    RollingFamily: item.rollingFamily,
    SodPosition: numberToDto(item.sodPosition, 'InventoryItem.sodPosition'),
    SodPvPv01: numberToDto(item.sodPvPv01, 'InventoryItem.sodPvPv01'),
    NewPosition: numberToDto(item.newPosition, 'InventoryItem.newPosition'),
    NewPv01: numberToDto(item.newPv01, 'InventoryItem.newPv01'),
  };
}

export function userMappingsRequestToDto(params: {
  requestId: string;
  userId: string;
}): MmuUserMappingsRequestDto {
  return { RequestId: params.requestId, UserId: params.userId };
}

export function riskRequestToDto(params: {
  requestId: string;
  mmuName: string;
  spreadCurves: string[];
  reportV4Request: ReportV4Request;
}): MmuRiskRequestDto {
  return {
    RequestId: params.requestId,
    MmuName: params.mmuName,
    SpreadCurves: params.spreadCurves,
    ReportV4Request: safeJsonStringify(params.reportV4Request, 'MmuRiskRequest.ReportV4Request'),
  };
}

export function inputsRequestToDto(params: {
  requestId: string;
  mmuName: string;
}): MmuInputsRequestDto {
  return { RequestId: params.requestId, MmuName: params.mmuName };
}

export function exportRequestToDto(params: {
  requestId: string;
  mmuName: string;
  userId: string;
  inventory: InventoryItem[];
  positionTargets: PositionTargetItem[];
}): ExportPositionsRequestDto {
  return {
    RequestId: params.requestId,
    MmuName: params.mmuName,
    UserId: params.userId,
    Inventory: params.inventory.map(inventoryItemToDto),
    PositionTargets: params.positionTargets.map(positionTargetToDto),
  };
}
