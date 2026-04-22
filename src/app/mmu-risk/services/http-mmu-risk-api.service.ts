import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import type {
  ExportPositionsResult,
  InventoryItem,
  MmuInputsResult,
  MmuRiskResult,
  MmuUserMappingsResult,
  PositionTargetItem,
  ReportV4Request,
} from '../models/model';
import type { MmuRiskApiPort } from '../models/ports';
import { generateRequestId } from '../models/request-id';
import {
  RawMmuInputsResponse,
  RawMmuRiskResponse,
  parseInputsResponse,
  parseRiskResponse,
} from '../models/parsers';

/**
 * Base URL prepended to every endpoint. Default '' lets the browser hit
 * same-origin paths. Override in app.config via
 * `{ provide: MMU_RISK_API_BASE_URL, useValue: 'https://api.example' }`.
 */
export const MMU_RISK_API_BASE_URL = new InjectionToken<string>('MMU_RISK_API_BASE_URL', {
  factory: () => '',
});

const ENDPOINTS = {
  userMappings: '/api/mmu/user-mappings',
  risk: '/api/mmu/risk',
  inputs: '/api/mmu/inputs',
  exportPositions: '/api/mmu/export-positions',
} as const;

@Injectable({ providedIn: 'root' })
export class HttpMmuRiskApiService implements MmuRiskApiPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(MMU_RISK_API_BASE_URL);

  getUserMappings(params: { userId: string }): Observable<MmuUserMappingsResult> {
    return this.http
      .post<MmuUserMappingsResult>(this.url(ENDPOINTS.userMappings), {
        requestId: generateRequestId(),
        userId: params.userId,
      })
      .pipe(catchError(normalizeHttpError('getUserMappings')));
  }

  getRisk(params: {
    mmuName: string;
    spreadCurves: string[];
    reportV4Request: ReportV4Request;
  }): Observable<MmuRiskResult> {
    return this.http
      .post<RawMmuRiskResponse>(this.url(ENDPOINTS.risk), {
        requestId: generateRequestId(),
        mmuName: params.mmuName,
        spreadCurves: params.spreadCurves,
        reportV4Request: params.reportV4Request,
      })
      .pipe(map(parseRiskResponse), catchError(normalizeHttpError('getRisk')));
  }

  getInputs(params: { mmuName: string }): Observable<MmuInputsResult> {
    return this.http
      .post<RawMmuInputsResponse>(this.url(ENDPOINTS.inputs), {
        requestId: generateRequestId(),
        mmuName: params.mmuName,
      })
      .pipe(map(parseInputsResponse), catchError(normalizeHttpError('getInputs')));
  }

  exportPositions(params: {
    mmuName: string;
    userId: string;
    inventory: InventoryItem[];
    positionTargets: PositionTargetItem[];
  }): Observable<ExportPositionsResult> {
    return this.http
      .post<ExportPositionsResult>(this.url(ENDPOINTS.exportPositions), {
        requestId: generateRequestId(),
        mmuName: params.mmuName,
        userId: params.userId,
        inventory: params.inventory,
        positionTargets: params.positionTargets.map(withAdjustedSums),
      })
      .pipe(catchError(normalizeHttpError('exportPositions')));
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }
}

/**
 * The wire contract requires adjusted* fields on each PositionTargetItem.
 * Multipliers are UI-only, so adjusted values are raw sums on the wire.
 */
function withAdjustedSums(item: PositionTargetItem): PositionTargetItem & {
  adjustedReflexPosition: number;
  adjustedEPosition: number;
} {
  return {
    ...item,
    adjustedReflexPosition: item.reflexPosition + item.manualAdjustment,
    adjustedEPosition: item.reflexPosition + item.targetPosition,
  };
}

function normalizeHttpError(operation: string) {
  return (err: unknown): Observable<never> => {
    if (err instanceof HttpErrorResponse) {
      const payloadError =
        err.error && typeof err.error === 'object' && 'error' in err.error
          ? String((err.error as { error: unknown }).error)
          : typeof err.error === 'string'
            ? err.error
            : '';
      const message = payloadError
        ? `${operation} ${err.status}: ${payloadError}`
        : `${operation} ${err.status}: ${err.statusText || 'request failed'}`;
      return throwError(() => new Error(message));
    }
    if (err instanceof Error) return throwError(() => err);
    return throwError(() => new Error(`${operation}: ${String(err)}`));
  };
}
