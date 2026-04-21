import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, EMPTY, pipe, switchMap, tap } from 'rxjs';
import { createDefaultReportV4Request } from '../contracts/default-report-v4';
import type {
  ExportPositionsResult,
  InventoryItem,
  MergedRow,
  MmuMultipliers,
  OverrideSource,
  PositionTargetItem,
  ReportV4Request,
  RiskItem,
} from '../contracts/model';
import type { MmuRiskApiPort } from '../contracts/ports';
import { MMU_RISK_API } from '../services/mmu-risk-api.token';

type MmuRiskState = {
  // identity
  userId: string;
  mmuName: string | null;
  availableMmuNames: string[];
  userMappingsLoading: boolean;
  userMappingsError: string | null;

  // request inputs
  spreadCurves: string[];
  reportV4Request: ReportV4Request;

  // risk response
  risk: RiskItem[];
  inventory: InventoryItem[];
  snapshotTime: Date | null;
  riskLoading: boolean;

  // inputs response
  positionTargets: PositionTargetItem[];
  lastPublishTime: Date | null;
  lastPublishedBy: string;
  comment: string;
  inputsLoading: boolean;

  // UI prefs (persist across reset)
  override: OverrideSource;
  multipliers: MmuMultipliers;

  // export
  exportStatus: ExportPositionsResult | null;
  exportLoading: boolean;

  // shared error
  error: string | null;
};

const INITIAL_SPREAD_CURVES: readonly string[] = ['1M', '6M', '12M', 'OIS'];

const initialState: MmuRiskState = {
  userId: 'DEFAULT_USER',
  mmuName: null,
  availableMmuNames: [],
  userMappingsLoading: false,
  userMappingsError: null,

  spreadCurves: [...INITIAL_SPREAD_CURVES],
  reportV4Request: createDefaultReportV4Request(),

  risk: [],
  inventory: [],
  snapshotTime: null,
  riskLoading: false,

  positionTargets: [],
  lastPublishTime: null,
  lastPublishedBy: '',
  comment: '',
  inputsLoading: false,

  override: 'risk',
  multipliers: {
    reflexPositionMultiplier: 1,
    manualAdjustmentMultiplier: 1,
    targetPositionMultiplier: 1,
  },

  exportStatus: null,
  exportLoading: false,

  error: null,
};

export const MmuRiskStore = signalStore(
  withState(initialState),

  withComputed((store) => ({
    hasMmuSelected: computed(() => store.mmuName() !== null),
    isLoading: computed(() => store.riskLoading() || store.inputsLoading()),
    hasRows: computed(
      () => store.risk().length > 0 || store.positionTargets().length > 0,
    ),
    mergedRows: computed(() =>
      mergeRows(store.risk(), store.positionTargets(), store.override()),
    ),
  })),

  withMethods((store, api = inject(MMU_RISK_API)) => {
    const loadUserMappings = rxMethod<void>(
      pipe(
        tap(() =>
          patchState(store, { userMappingsLoading: true, userMappingsError: null }),
        ),
        switchMap(() =>
          api.getUserMappings({ userId: store.userId() }).pipe(
            tap((result) =>
              patchState(store, {
                availableMmuNames: result.mmuNames,
                spreadCurves: result.spreadCurves ?? store.spreadCurves(),
                userMappingsLoading: false,
              }),
            ),
            catchError((err) => {
              patchState(store, {
                userMappingsLoading: false,
                userMappingsError: describeError(err),
              });
              return EMPTY;
            }),
          ),
        ),
      ),
    );

    const refreshRisk = rxMethod<void>(
      pipe(
        switchMap(() => {
          const requestedMmuName = store.mmuName();
          if (!requestedMmuName) return EMPTY;
          console.log('[mmu-risk] Refresh Risk clicked', { mmuName: requestedMmuName });
          patchState(store, { riskLoading: true, error: null });
          return api
            .getRisk({
              mmuName: requestedMmuName,
              spreadCurves: store.spreadCurves(),
              reportV4Request: store.reportV4Request(),
            })
            .pipe(
              tap((result) => {
                if (store.mmuName() !== requestedMmuName) return; // stale response, drop
                patchState(store, {
                  risk: result.risk,
                  inventory: result.inventory,
                  snapshotTime: result.snapshotTime,
                  spreadCurves: result.spreadCurves,
                  riskLoading: false,
                });
              }),
              catchError((err) => {
                if (store.mmuName() !== requestedMmuName) return EMPTY;
                patchState(store, { riskLoading: false, error: describeError(err) });
                return EMPTY;
              }),
            );
        }),
      ),
    );

    const refreshInputs = rxMethod<void>(
      pipe(
        switchMap(() => {
          const requestedMmuName = store.mmuName();
          if (!requestedMmuName) return EMPTY;
          console.log('[mmu-risk] Refresh Inputs clicked', { mmuName: requestedMmuName });
          patchState(store, { inputsLoading: true, error: null });
          return api.getInputs({ mmuName: requestedMmuName }).pipe(
            tap((result) => {
              if (store.mmuName() !== requestedMmuName) return;
              patchState(store, {
                positionTargets: result.positionTargets,
                lastPublishTime: result.lastPublishTime,
                lastPublishedBy: result.lastPublishedBy,
                comment: result.comment,
                inputsLoading: false,
              });
            }),
            catchError((err) => {
              if (store.mmuName() !== requestedMmuName) return EMPTY;
              patchState(store, { inputsLoading: false, error: describeError(err) });
              return EMPTY;
            }),
          );
        }),
      ),
    );

    const exportPositions = rxMethod<void>(
      pipe(
        switchMap(() => {
          const requestedMmuName = store.mmuName();
          if (!requestedMmuName) return EMPTY;
          console.log('[mmu-risk] Export Positions clicked', { mmuName: requestedMmuName });
          patchState(store, { exportLoading: true, exportStatus: null });
          return api
            .exportPositions({
              mmuName: requestedMmuName,
              userId: store.userId(),
              inventory: store.inventory(),
              positionTargets: store.positionTargets(),
            })
            .pipe(
              tap((result) => {
                if (store.mmuName() !== requestedMmuName) return;
                patchState(store, { exportStatus: result, exportLoading: false });
              }),
              catchError((err) => {
                if (store.mmuName() !== requestedMmuName) return EMPTY;
                patchState(store, {
                  exportLoading: false,
                  exportStatus: { success: false, error: describeError(err) },
                });
                return EMPTY;
              }),
            );
        }),
      ),
    );

    return {
      loadUserMappings,
      refreshRisk,
      refreshInputs,
      exportPositions,

      setUserId(userId: string): void {
        patchState(store, { userId });
      },
      setMmuName(mmuName: string | null): void {
        console.log('[mmu-risk] MMU selected', { mmuName });
        patchState(store, { mmuName });
      },
      setSpreadCurves(spreadCurves: string[]): void {
        patchState(store, { spreadCurves });
      },
      setReportV4Request(reportV4Request: ReportV4Request): void {
        patchState(store, { reportV4Request });
      },
      setOverride(override: OverrideSource): void {
        console.log('[mmu-risk] Override toggle changed', { override });
        patchState(store, { override });
      },
      updateMultipliers(multipliers: MmuMultipliers): void {
        patchState(store, { multipliers });
      },
      updatePositionTargetField(
        tenor: string,
        field: keyof Omit<PositionTargetItem, 'tenor'>,
        value: number,
      ): void {
        patchState(store, {
          positionTargets: store
            .positionTargets()
            .map((row) => (row.tenor === tenor ? { ...row, [field]: value } : row)),
        });
      },
      dismissExportStatus(): void {
        patchState(store, { exportStatus: null });
      },
      enterMmu(mmuName: string): void {
        console.log('[mmu-risk] MMU selected', { mmuName });
        patchState(store, { mmuName });
        refreshRisk();
        refreshInputs();
      },
      reset(): void {
        // Keep user-level prefs (userId, spreadCurves, reportV4Request, multipliers, override).
        // Clear everything tied to a specific MMU session.
        patchState(store, {
          mmuName: null,
          availableMmuNames: [],
          userMappingsLoading: false,
          userMappingsError: null,
          risk: [],
          inventory: [],
          snapshotTime: null,
          riskLoading: false,
          positionTargets: [],
          lastPublishTime: null,
          lastPublishedBy: '',
          comment: '',
          inputsLoading: false,
          exportStatus: null,
          exportLoading: false,
          error: null,
        });
      },
    };
  }),
);

export function mergeRows(
  risk: RiskItem[],
  positionTargets: PositionTargetItem[],
  override: OverrideSource,
): MergedRow[] {
  const byTenor = new Map<string, MergedRow>();
  const ensure = (tenor: string): MergedRow => {
    let row = byTenor.get(tenor);
    if (!row) {
      row = {
        tenor,
        reflexPosition: null,
        manualAdjustment: null,
        adjustedReflexPosition: null,
        targetPosition: null,
        adjustedEPosition: null,
      };
      byTenor.set(tenor, row);
    }
    return row;
  };

  for (const r of risk) {
    ensure(r.tenor).reflexPosition = r.value;
  }
  for (const p of positionTargets) {
    const row = ensure(p.tenor);
    row.manualAdjustment = p.manualAdjustment;
    row.adjustedReflexPosition = p.adjustedReflexPosition;
    row.targetPosition = p.targetPosition;
    row.adjustedEPosition = p.adjustedEPosition;
    if (override === 'inputs' || row.reflexPosition === null) {
      row.reflexPosition = p.reflexPosition;
    }
  }
  return Array.from(byTenor.values());
}

function describeError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.length > 0) return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}
