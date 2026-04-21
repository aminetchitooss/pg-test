import type {
  ExportPositionsResponseDto,
  InventoryItemDto,
  MmuInputsResponseDto,
  MmuRiskResponseDto,
  MmuUserMappingsResponseDto,
  PositionTargetItemDto,
  RiskItemDto,
} from '../../contracts/dto';
import { MMU_TENORS, REFLEX_SEED_VALUES } from './mmu-tenors.fixture';

const MOCK_MMU_NAMES = ['EUR_SWAP_DESK', 'USD_RATES_DESK', 'GBP_GILTS_DESK'];
const MOCK_SPREAD_CURVES = ['1M', '6M', '12M', 'OIS'];

function riskItems(jitter: number): RiskItemDto[] {
  return MMU_TENORS.map((tenor, i) => {
    const base = REFLEX_SEED_VALUES[i] ?? 0;
    const variance = jitter === 0 ? 0 : Math.round((Math.random() - 0.5) * jitter * 2);
    return { Tenor: tenor, Value: String(base + variance) };
  });
}

function positionTargets(): PositionTargetItemDto[] {
  return MMU_TENORS.map((tenor, i) => {
    const base = REFLEX_SEED_VALUES[i] ?? 0;
    return {
      Tenor: tenor,
      ReflexPosition: String(base),
      ManualAdjustment: '0',
      AdjustedReflexPosition: String(base),
      TargetPosition: String(base),
      AdjustedEPosition: String(base),
    };
  });
}

function inventory(): InventoryItemDto[] {
  return ['EUR-1Y', 'EUR-5Y', 'USD-2Y', 'USD-10Y'].map((family, i) => ({
    RollingFamily: family,
    SodPosition: String((i + 1) * 100),
    SodPvPv01: String((i + 1) * 10),
    NewPosition: String((i + 1) * 100),
    NewPv01: String((i + 1) * 10),
  }));
}

export function mockUserMappingsDto(requestId: string): MmuUserMappingsResponseDto {
  return {
    RequestId: requestId,
    MmuNames: [...MOCK_MMU_NAMES],
    SpreadCurves: [...MOCK_SPREAD_CURVES],
  };
}

export function mockRiskDto(
  requestId: string,
  spreadCurves: string[],
  jitter: number,
): MmuRiskResponseDto {
  return {
    RequestId: requestId,
    SpreadCurves: spreadCurves.length ? spreadCurves : [...MOCK_SPREAD_CURVES],
    SnapshotTime: new Date().toISOString(),
    Risk: riskItems(jitter),
    Inventory: inventory(),
  };
}

export function mockEmptyRiskDto(requestId: string): MmuRiskResponseDto {
  return {
    RequestId: requestId,
    SpreadCurves: [...MOCK_SPREAD_CURVES],
    SnapshotTime: new Date().toISOString(),
    Risk: [],
    Inventory: [],
  };
}

export function mockInputsDto(requestId: string, mmuName: string): MmuInputsResponseDto {
  return {
    RequestId: requestId,
    MmuName: mmuName,
    LastPublishTime: new Date(Date.now() - 3600_000).toISOString(),
    LastPublishedBy: 'jdoe',
    Comment: 'EoD sign-off',
    PositionTargets: positionTargets(),
  };
}

export function mockExportDto(): ExportPositionsResponseDto {
  return { Success: 'true', Error: '' };
}
