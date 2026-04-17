import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, EMPTY, pipe, switchMap, tap } from 'rxjs';
import type {
  ColumnMeta,
  DataRow,
  MmuMultipliers,
  MmuStatus,
  OverrideSource,
} from '../models/mmu-risk.model';
import { ConfigManagerApiService } from '../services/config-manager-api.service';
import { RiskApiService } from '../services/risk-api.service';
import { mergeColumns, mergeRows } from '../utils/merge';

type MmuRiskState = {
  riskColumns: ColumnMeta[];
  riskRows: DataRow[];
  riskStatus: MmuStatus | null;
  riskLoading: boolean;
  configColumns: ColumnMeta[];
  configRows: DataRow[];
  configLoading: boolean;
  override: OverrideSource;
  inputsIncludeRiskColumns: boolean;
  multipliers: MmuMultipliers;
  spreadCurves: string;
  error: string | null;
};

const initialState: MmuRiskState = {
  riskColumns: [],
  riskRows: [],
  riskStatus: null,
  riskLoading: false,
  configColumns: [],
  configRows: [],
  configLoading: false,
  override: 'risk',
  inputsIncludeRiskColumns: false,
  multipliers: {
    reflexPositionMultiplier: 1,
    manualAdjustmentMultiplier: 1,
    targetPositionMultiplier: 1,
  },
  spreadCurves: '1M,6M,12M,OIS',
  error: null,
};

export const MmuRiskStore = signalStore(
  withState(initialState),

  withComputed((store) => {
    const columns = computed(() => mergeColumns(store.riskColumns(), store.configColumns()));
    const rows = computed(() =>
      mergeRows(store.riskRows(), store.configRows(), columns(), store.override()),
    );
    const isLoading = computed(() => store.riskLoading() || store.configLoading());
    const status = computed(() => store.riskStatus());
    return { columns, rows, isLoading, status };
  }),

  withMethods(
    (
      store,
      riskApi = inject(RiskApiService),
      configManagerApi = inject(ConfigManagerApiService),
    ) => ({
      refreshRisk: rxMethod<void>(
        pipe(
          tap(() => {
            console.log('[mmu-risk] Refresh Risk clicked');
            patchState(store, { riskLoading: true, error: null });
          }),
          switchMap(() =>
            riskApi.fetchRisk().pipe(
              tap((response) =>
                patchState(store, {
                  riskColumns: response.columns,
                  riskRows: response.rows,
                  riskStatus: response.status,
                  riskLoading: false,
                }),
              ),
              catchError((err) => {
                patchState(store, { riskLoading: false, error: String(err) });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      refreshInputs: rxMethod<void>(
        pipe(
          tap(() => {
            console.log('[mmu-risk] Refresh Inputs clicked', {
              includeRiskColumns: store.inputsIncludeRiskColumns(),
            });
            patchState(store, { configLoading: true, error: null });
          }),
          switchMap(() =>
            configManagerApi
              .fetchInputs({ includeRiskColumns: store.inputsIncludeRiskColumns() })
              .pipe(
                tap((response) =>
                  patchState(store, {
                    configColumns: response.columns,
                    configRows: response.rows,
                    configLoading: false,
                  }),
                ),
                catchError((err) => {
                  patchState(store, { configLoading: false, error: String(err) });
                  return EMPTY;
                }),
              ),
          ),
        ),
      ),

      init(): void {
        this.refreshRisk();
        this.refreshInputs();
      },

      setOverride(override: OverrideSource): void {
        console.log('[mmu-risk] Override toggle changed', { override });
        patchState(store, { override });
      },

      setInputsIncludeRiskColumns(value: boolean): void {
        console.log('[mmu-risk] Include risk columns toggle changed', { value });
        patchState(store, { inputsIncludeRiskColumns: value });
      },

      updateMultipliers(multipliers: MmuMultipliers): void {
        patchState(store, { multipliers });
      },

      updateSpreadCurves(spreadCurves: string): void {
        patchState(store, { spreadCurves });
      },

      updateRow(qualifiedTenor: string, updated: DataRow): void {
        const patchList = (rows: DataRow[]): DataRow[] =>
          rows.map((r) => (r.qualifiedTenor === qualifiedTenor ? { ...r, ...updated } : r));
        patchState(store, {
          riskRows: patchList(store.riskRows()),
          configRows: patchList(store.configRows()),
        });
      },
    }),
  ),
);
