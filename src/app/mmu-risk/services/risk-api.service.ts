import { Injectable } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import type { DataRow, MmuStatus, RiskApiResponse } from '../models/mmu-risk.model';
import { MMU_TENORS, REFLEX_SEED_VALUES } from './fixtures/mmu-tenors.fixture';
import { RISK_COLUMNS, RISK_STATUS_DEFAULTS } from './fixtures/risk-columns.fixture';

@Injectable({ providedIn: 'root' })
export class RiskApiService {
  private callCount = 0;

  fetchRisk(): Observable<RiskApiResponse> {
    this.callCount++;
    const jitter = this.callCount === 1 ? 0 : 25;

    return timer(300).pipe(
      map(() => {
        const rows: DataRow[] = MMU_TENORS.map((tenor, i) => {
          const base = REFLEX_SEED_VALUES[i] ?? 0;
          const variance = jitter === 0 ? 0 : Math.round((Math.random() - 0.5) * jitter * 2);
          const reflex = base + variance;
          return {
            qualifiedTenor: tenor,
            reflexPosition: reflex,
            adjustedReflexPosition: reflex,
          };
        });
        const status: MmuStatus = {
          ...RISK_STATUS_DEFAULTS,
          snapshotTime: `${currentClock()} [00:00:00 since last update]`,
        };
        return { columns: [...RISK_COLUMNS], rows, status };
      }),
    );
  }
}

function currentClock(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
