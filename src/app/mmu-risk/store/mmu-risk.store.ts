import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, EMPTY, pipe, switchMap, tap } from 'rxjs';
import { createDefaultReportV4Request } from '../models/default-report-v4';
import type {
  EditableMergedRowField,
  ExportPositionsResult,
  InventoryItem,
  MergedRow,
  MmuMultipliers,
  PositionTargetItem,
  ReportV4Request,
  RiskItem,
} from '../models/model';
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
  spreadCurvesEditable: boolean;
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
  spreadCurvesEditable: true,
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
    hasRows: computed(() => store.risk().length > 0),
    mergedRows: computed(() => mergeRows(store.risk(), store.positionTargets())),
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
                if (store.mmuName() !== requestedMmuName) return;
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
          const payload = buildExportPayload(store.risk(), store.positionTargets());
          return api
            .exportPositions({
              mmuName: requestedMmuName,
              userId: store.userId(),
              inventory: store.inventory(),
              positionTargets: payload,
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
      setSpreadCurvesEditable(editable: boolean): void {
        patchState(store, { spreadCurvesEditable: editable });
      },
      setReportV4Request(reportV4Request: ReportV4Request): void {
        patchState(store, { reportV4Request });
      },
      updateMultipliers(multipliers: MmuMultipliers): void {
        patchState(store, { multipliers });
      },
      updatePositionTargetField(
        tenor: string,
        field: EditableMergedRowField,
        value: number,
      ): void {
        const existing = store.positionTargets();
        const hasTenor = existing.some((row) => row.tenor === tenor);
        if (hasTenor) {
          patchState(store, {
            positionTargets: existing.map((row) =>
              row.tenor === tenor ? { ...row, [field]: value } : row,
            ),
          });
          return;
        }
        // User edited a zero-defaulted row that doesn't exist in positionTargets yet —
        // materialize it now so the edit survives.
        const reflex = store.risk().find((r) => r.tenor === tenor)?.value ?? 0;
        const fresh: PositionTargetItem = {
          tenor,
          reflexPosition: reflex,
          manualAdjustment: 0,
          targetPosition: 0,
          [field]: value,
        };
        patchState(store, { positionTargets: [...existing, fresh] });
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
      changeMmu(mmuName: string): void {
        // Called from the "Edit MMU" flow. Same as enterMmu but preserves the
        // semantics that "refresh replaces everything" — we wipe derived state
        // for the old MMU first.
        console.log('[mmu-risk] MMU changed', { mmuName });
        patchState(store, {
          mmuName,
          risk: [],
          inventory: [],
          snapshotTime: null,
          positionTargets: [],
          lastPublishTime: null,
          lastPublishedBy: '',
          comment: '',
          exportStatus: null,
          error: null,
        });
        refreshRisk();
        refreshInputs();
      },
      reset(): void {
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

/** Build the 4-field view. Tenors come from Risk; missing Inputs → zeros. */
export function mergeRows(risk: RiskItem[], positionTargets: PositionTargetItem[]): MergedRow[] {
  const targetByTenor = new Map(positionTargets.map((p) => [p.tenor, p]));
  return risk.map((r) => {
    const t = targetByTenor.get(r.tenor);
    return {
      tenor: r.tenor,
      reflexPosition: r.value,
      manualAdjustment: t?.manualAdjustment ?? 0,
      targetPosition: t?.targetPosition ?? 0,
    };
  });
}

/**
 * Export payload: one entry per tenor in Risk. ReflexPosition always comes from
 * Risk (authoritative); manual/target from positionTargets if known, else 0.
 * Mapper.positionTargetToDto computes the adjusted fields as raw sums.
 */
function buildExportPayload(
  risk: RiskItem[],
  positionTargets: PositionTargetItem[],
): PositionTargetItem[] {
  const targetByTenor = new Map(positionTargets.map((p) => [p.tenor, p]));
  return risk.map((r) => {
    const t = targetByTenor.get(r.tenor);
    return {
      tenor: r.tenor,
      reflexPosition: r.value,
      manualAdjustment: t?.manualAdjustment ?? 0,
      targetPosition: t?.targetPosition ?? 0,
    };
  });
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
