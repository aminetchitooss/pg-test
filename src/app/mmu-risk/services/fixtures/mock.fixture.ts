import type {
  ExportPositionsResult,
  InventoryItem,
  MmuInputsResult,
  MmuRiskResult,
  MmuUserMappingsResult,
  PositionTargetItem,
  RiskItem,
} from '../../models/model';
import { MMU_TENORS, REFLEX_SEED_VALUES } from './mmu-tenors.fixture';

const MOCK_MMU_NAMES = ['EUR_SWAP_DESK', 'USD_RATES_DESK', 'GBP_GILTS_DESK'];
const MOCK_SPREAD_CURVES = ['1M', '6M', '12M', 'OIS'];

function riskItems(jitter: number): RiskItem[] {
  return MMU_TENORS.map((tenor, i) => {
    const base = REFLEX_SEED_VALUES[i] ?? 0;
    const variance = jitter === 0 ? 0 : Math.round((Math.random() - 0.5) * jitter * 2);
    return { tenor, value: base + variance };
  });
}

function positionTargets(): PositionTargetItem[] {
  return MMU_TENORS.map((tenor, i) => {
    const base = REFLEX_SEED_VALUES[i] ?? 0;
    return { tenor, reflexPosition: base, manualAdjustment: 0, targetPosition: 0 };
  });
}

function inventory(): InventoryItem[] {
  return ['EUR-1Y', 'EUR-5Y', 'USD-2Y', 'USD-10Y'].map((family, i) => ({
    rollingFamily: family,
    sodPosition: (i + 1) * 100,
    sodPvPv01: (i + 1) * 10,
    newPosition: (i + 1) * 100,
    newPv01: (i + 1) * 10,
  }));
}

export function mockUserMappings(): MmuUserMappingsResult {
  return { mmuNames: [...MOCK_MMU_NAMES], spreadCurves: [...MOCK_SPREAD_CURVES] };
}

export function mockRisk(spreadCurves: string[], jitter: number): MmuRiskResult {
  return {
    spreadCurves: spreadCurves.length ? spreadCurves : [...MOCK_SPREAD_CURVES],
    snapshotTime: new Date(),
    risk: riskItems(jitter),
    inventory: inventory(),
  };
}

export function mockEmptyRisk(): MmuRiskResult {
  return {
    spreadCurves: [...MOCK_SPREAD_CURVES],
    snapshotTime: new Date(),
    risk: [],
    inventory: [],
  };
}

export function mockInputs(mmuName: string): MmuInputsResult {
  return {
    mmuName,
    lastPublishTime: new Date(Date.now() - 3600_000),
    lastPublishedBy: 'jdoe',
    comment: 'EoD sign-off',
    positionTargets: positionTargets(),
  };
}

export function mockExport(): ExportPositionsResult {
  return { success: true, error: '' };
}
