import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';
import { RiskPositionApiService } from '../services/risk-position-api.service';
import type {
  RiskPositionApiResponse,
  RiskPositionMultipliers,
  RiskPositionRow,
  RiskViewType,
} from '../models/risk-position.model';

type RiskPositionState = {
  apiResponse: RiskPositionApiResponse | null;
  isLoading: boolean;
  multipliers: RiskPositionMultipliers;
  spreadCurves: string;
  rows: RiskPositionRow[];
  viewType: RiskViewType;
};

const initialState: RiskPositionState = {
  apiResponse: null,
  isLoading: false,
  multipliers: {
    reflexPositionMultiplier: 1,
    manualAdjustmentMultiplier: 1,
    targetPositionMultiplier: 1,
  },
  spreadCurves: '1M,6M,12M,OIS',
  rows: [],
  viewType: 'risk-position',
};

export const RiskPositionStore = signalStore(
  withState(initialState),

  withComputed((store) => ({
    columns: computed(() => store.apiResponse()?.columns ?? []),
    status: computed(() => store.apiResponse()?.status ?? null),
  })),

  withMethods((store, apiService = inject(RiskPositionApiService)) => ({
    init(viewType: RiskViewType): void {
      patchState(store, { viewType });
      this.loadData();
    },

    loadData: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true })),
        switchMap(() =>
          apiService.fetchRiskPositions(store.viewType()).pipe(
            tap((response) =>
              patchState(store, {
                apiResponse: response,
                rows: response.rows,
                isLoading: false,
              }),
            ),
          ),
        ),
      ),
    ),

    refreshInputs: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true })),
        switchMap(() =>
          apiService.refreshInputs(store.viewType()).pipe(
            tap((response) =>
              patchState(store, {
                apiResponse: response,
                rows: response.rows,
                isLoading: false,
              }),
            ),
          ),
        ),
      ),
    ),

    updateMultipliers(multipliers: RiskPositionMultipliers): void {
      patchState(store, { multipliers });
    },

    updateSpreadCurves(spreadCurves: string): void {
      patchState(store, { spreadCurves });
    },

    updateRow(qualifiedTenor: string, updatedRowData: RiskPositionRow): void {
      patchState(store, {
        rows: store.rows().map((row) =>
          row.qualifiedTenor === qualifiedTenor ? { ...updatedRowData } : row,
        ),
      });
    },
  })),
);
