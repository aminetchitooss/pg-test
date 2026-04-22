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
} from '../models/model';
import type { MmuRiskApiPort } from '../models/ports';
import {
  mockEmptyRisk,
  mockExport,
  mockInputs,
  mockRisk,
  mockUserMappings,
} from './fixtures/mock.fixture';

const MOCK_LATENCY_MS = 300;

export type MockEndpoint =
  | 'getUserMappings'
  | 'getRisk'
  | 'getInputs'
  | 'exportPositions';

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
    return timer(MOCK_LATENCY_MS).pipe(map(() => mockUserMappings()));
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
      map(() => (empty ? mockEmptyRisk() : mockRisk(params.spreadCurves, jitter))),
    );
  }

  getInputs(params: { mmuName: string }): Observable<MmuInputsResult> {
    const failure = consumeFailure('getInputs');
    if (failure) return delayedError(failure);
    return timer(MOCK_LATENCY_MS).pipe(map(() => mockInputs(params.mmuName)));
  }

  exportPositions(_params: {
    mmuName: string;
    userId: string;
    inventory: InventoryItem[];
    positionTargets: PositionTargetItem[];
  }): Observable<ExportPositionsResult> {
    const failure = consumeFailure('exportPositions');
    if (failure) return delayedError(failure);
    return timer(MOCK_LATENCY_MS).pipe(map(() => mockExport()));
  }
}

function delayedError(message: string): Observable<never> {
  return new Observable<never>((sub) => {
    const id = setTimeout(() => sub.error(new Error(message)), MOCK_LATENCY_MS);
    return () => clearTimeout(id);
  });
}
