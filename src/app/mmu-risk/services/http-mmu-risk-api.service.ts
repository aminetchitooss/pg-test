import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import type {
  ExportPositionsResponseDto,
  MmuInputsResponseDto,
  MmuRiskResponseDto,
  MmuUserMappingsResponseDto,
} from '../contracts/dto';
import {
  exportRequestToDto,
  exportResponseFromDto,
  inputsRequestToDto,
  inputsResponseFromDto,
  riskRequestToDto,
  riskResponseFromDto,
  userMappingsFromDto,
  userMappingsRequestToDto,
} from '../contracts/mapper';
import type {
  ExportPositionsResult,
  InventoryItem,
  MmuInputsResult,
  MmuRiskResult,
  MmuUserMappingsResult,
  PositionTargetItem,
  ReportV4Request,
} from '../contracts/model';
import type { MmuRiskApiPort } from '../contracts/ports';
import { generateRequestId } from '../contracts/request-id';

/**
 * Base URL prepended to every endpoint. Default '' lets the browser
 * hit same-origin paths. Override in app.config via
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
    const body = userMappingsRequestToDto({ requestId: generateRequestId(), userId: params.userId });
    return this.http
      .post<MmuUserMappingsResponseDto>(this.url(ENDPOINTS.userMappings), body)
      .pipe(map(userMappingsFromDto), catchError(normalizeHttpError('getUserMappings')));
  }

  getRisk(params: {
    mmuName: string;
    spreadCurves: string[];
    reportV4Request: ReportV4Request;
  }): Observable<MmuRiskResult> {
    const body = riskRequestToDto({ requestId: generateRequestId(), ...params });
    return this.http
      .post<MmuRiskResponseDto>(this.url(ENDPOINTS.risk), body)
      .pipe(map(riskResponseFromDto), catchError(normalizeHttpError('getRisk')));
  }

  getInputs(params: { mmuName: string }): Observable<MmuInputsResult> {
    const body = inputsRequestToDto({ requestId: generateRequestId(), ...params });
    return this.http
      .post<MmuInputsResponseDto>(this.url(ENDPOINTS.inputs), body)
      .pipe(map(inputsResponseFromDto), catchError(normalizeHttpError('getInputs')));
  }

  exportPositions(params: {
    mmuName: string;
    userId: string;
    inventory: InventoryItem[];
    positionTargets: PositionTargetItem[];
  }): Observable<ExportPositionsResult> {
    const body = exportRequestToDto({ requestId: generateRequestId(), ...params });
    return this.http
      .post<ExportPositionsResponseDto>(this.url(ENDPOINTS.exportPositions), body)
      .pipe(map(exportResponseFromDto), catchError(normalizeHttpError('exportPositions')));
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }
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
