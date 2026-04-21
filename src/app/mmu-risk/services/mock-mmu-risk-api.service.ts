import { Injectable } from '@angular/core';
import { map, Observable, timer } from 'rxjs';
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
import {
  exportResponseFromDto,
  inputsResponseFromDto,
  riskResponseFromDto,
  userMappingsFromDto,
} from '../contracts/mapper';
import { generateRequestId } from '../contracts/request-id';
import {
  mockEmptyRiskDto,
  mockExportDto,
  mockInputsDto,
  mockRiskDto,
  mockUserMappingsDto,
} from './fixtures/mock-dto.fixture';

const MOCK_LATENCY_MS = 300;

export type MockEndpoint =
  | 'getUserMappings'
  | 'getRisk'
  | 'getInputs'
  | 'exportPositions';

/**
 * Test hook attached to window in dev only. Lets Playwright simulate
 * per-endpoint errors and empty responses without re-wiring DI.
 */
export interface MockControl {
  failNext: Partial<Record<MockEndpoint, string | null>>;
  emptyRiskNext: boolean;
}

function ensureControl(): MockControl {
  const w = window as unknown as { __mmuRiskMockControl?: MockControl };
  if (!w.__mmuRiskMockControl) {
    w.__mmuRiskMockControl = { failNext: {}, emptyRiskNext: false };
  }
  return w.__mmuRiskMockControl;
}

function consumeFailure(endpoint: MockEndpoint): string | null {
  const c = ensureControl();
  const msg = c.failNext[endpoint];
  if (msg) {
    c.failNext[endpoint] = null;
    return msg;
  }
  return null;
}

function consumeEmptyRisk(): boolean {
  const c = ensureControl();
  if (c.emptyRiskNext) {
    c.emptyRiskNext = false;
    return true;
  }
  return false;
}

@Injectable({ providedIn: 'root' })
export class MockMmuRiskApiService implements MmuRiskApiPort {
  private riskCallCount = 0;

  getUserMappings(_params: { userId: string }): Observable<MmuUserMappingsResult> {
    const failure = consumeFailure('getUserMappings');
    if (failure) return delayedError(failure);
    return timer(MOCK_LATENCY_MS).pipe(
      map(() => userMappingsFromDto(mockUserMappingsDto(generateRequestId()))),
    );
  }

  getRisk(params: {
    mmuName: string;
    spreadCurves: string[];
    reportV4Request: ReportV4Request;
  }): Observable<MmuRiskResult> {
    const failure = consumeFailure('getRisk');
    if (failure) return delayedError(failure);
    const empty = consumeEmptyRisk();
    this.riskCallCount += 1;
    const jitter = this.riskCallCount === 1 ? 0 : 25;
    return timer(MOCK_LATENCY_MS).pipe(
      map(() =>
        riskResponseFromDto(
          empty
            ? mockEmptyRiskDto(generateRequestId())
            : mockRiskDto(generateRequestId(), params.spreadCurves, jitter),
        ),
      ),
    );
  }

  getInputs(params: { mmuName: string }): Observable<MmuInputsResult> {
    const failure = consumeFailure('getInputs');
    if (failure) return delayedError(failure);
    return timer(MOCK_LATENCY_MS).pipe(
      map(() => inputsResponseFromDto(mockInputsDto(generateRequestId(), params.mmuName))),
    );
  }

  exportPositions(_params: {
    mmuName: string;
    userId: string;
    inventory: InventoryItem[];
    positionTargets: PositionTargetItem[];
  }): Observable<ExportPositionsResult> {
    const failure = consumeFailure('exportPositions');
    if (failure) return delayedError(failure);
    return timer(MOCK_LATENCY_MS).pipe(map(() => exportResponseFromDto(mockExportDto())));
  }
}

function delayedError(message: string): Observable<never> {
  return new Observable<never>((sub) => {
    const id = setTimeout(() => sub.error(new Error(message)), MOCK_LATENCY_MS);
    return () => clearTimeout(id);
  });
}
