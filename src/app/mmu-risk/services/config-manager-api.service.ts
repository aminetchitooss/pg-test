import { Injectable } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ConfigManagerApiResponse, DataRow } from '../models/mmu-risk.model';
import { CONFIG_MANAGER_COLUMN_CATALOG } from './fixtures/config-manager-columns.fixture';
import {
  SCHEMAS_WITHOUT_RISK_OVERLAP,
  SCHEMAS_WITH_RISK_OVERLAP,
} from './fixtures/config-manager-schemas.fixture';
import { MMU_TENORS, REFLEX_SEED_VALUES } from './fixtures/mmu-tenors.fixture';

export interface ConfigManagerFetchOptions {
  /** When true, response may include columns that overlap with the risk API. */
  includeRiskColumns?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfigManagerApiService {
  private callCount = 0;

  fetchInputs(options: ConfigManagerFetchOptions = {}): Observable<ConfigManagerApiResponse> {
    const pool = options.includeRiskColumns
      ? SCHEMAS_WITH_RISK_OVERLAP
      : SCHEMAS_WITHOUT_RISK_OVERLAP;
    const schemaFields = pool[this.callCount % pool.length];
    const firstCall = this.callCount === 0;
    this.callCount++;

    return timer(350).pipe(
      map(() => {
        const columns = schemaFields.map((field) => CONFIG_MANAGER_COLUMN_CATALOG[field]);
        const rows: DataRow[] = MMU_TENORS.map((tenor, i) => {
          const seed = REFLEX_SEED_VALUES[i] ?? 0;
          const manual = firstCall ? 0 : Math.round((Math.random() - 0.5) * 30);
          const target = firstCall ? 0 : Math.round((Math.random() - 0.5) * 20);
          const row: DataRow = { qualifiedTenor: tenor };
          for (const field of schemaFields) {
            if (field === 'qualifiedTenor') continue;
            row[field] = valueForField(field, { seed, manual, target });
          }
          return row;
        });
        return { columns, rows };
      }),
    );
  }
}

function valueForField(
  field: string,
  ctx: { seed: number; manual: number; target: number },
): number {
  switch (field) {
    case 'manualAdjustment':
      return ctx.manual;
    case 'reflexPosition':
      return ctx.seed + Math.round((Math.random() - 0.5) * 10);
    case 'adjustedReflexPosition':
      return ctx.seed + ctx.manual;
    case 'targetPosition':
      return ctx.target;
    case 'adjustedEPosition':
      return ctx.seed + ctx.manual - ctx.target;
    case 'cvaExposure':
      return Math.round(Math.abs(ctx.seed) * (0.05 + Math.random() * 0.2));
    case 'hedgeRatio':
      return Math.round((0.4 + Math.random() * 0.6) * 100) / 100;
    default:
      return 0;
  }
}
