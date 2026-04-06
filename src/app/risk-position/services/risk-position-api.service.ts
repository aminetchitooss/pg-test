import { Injectable } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import type {
  RiskPositionApiResponse,
  RiskPositionColumnMeta,
  RiskPositionRow,
  RiskPositionStatus,
  RiskViewType,
} from '../models/risk-position.model';

@Injectable({ providedIn: 'root' })
export class RiskPositionApiService {
  private readonly columnsByView: Record<RiskViewType, RiskPositionColumnMeta[]> = {
    'risk-position': [
      { field: 'qualifiedTenor', headerName: 'Qualified Tenor', type: 'text' },
      { field: 'reflexPosition', headerName: 'Reflex Position', type: 'numeric' },
      {
        field: 'manualAdjustment',
        headerName: 'Manual Adjustment (K Units)',
        type: 'numeric',
        editable: true,
      },
      {
        field: 'adjustedReflexPosition',
        headerName: 'Adjusted Reflex Position (K units)',
        type: 'numeric',
      },
      { field: 'targetPosition', headerName: 'Target Position (K Units)', type: 'numeric' },
      { field: 'adjustedEPosition', headerName: 'Adjusted e-Position', type: 'numeric' },
    ],
    'pnl-attribution': [
      { field: 'qualifiedTenor', headerName: 'Instrument', type: 'text' },
      { field: 'dailyPnl', headerName: 'Daily P&L', type: 'numeric' },
      { field: 'mtdPnl', headerName: 'MTD P&L', type: 'numeric' },
      { field: 'ytdPnl', headerName: 'YTD P&L', type: 'numeric' },
      { field: 'delta', headerName: 'Delta', type: 'numeric' },
      { field: 'gamma', headerName: 'Gamma', type: 'numeric' },
      { field: 'vega', headerName: 'Vega', type: 'numeric' },
      { field: 'theta', headerName: 'Theta', type: 'numeric' },
    ],
  };

  private readonly tenors: string[] = [
    'Delta_O/N',
    'Delta_T/N',
    'Delta_D:06-MAY-2026',
    'Delta_D:06-MAY-2026*D:17-JUN-2026',
    'Delta_D:17-JUN-2026*D:29-JUL-2026',
    'Delta_D:29-JUL-2026*D:16-SEP-2026',
    'Delta_D:16-SEP-2026*D:04-NOV-2026',
    'Delta_D:04-NOV-2026*D:23-DEC-2026',
    'Delta_D:23-DEC-2026*D:03-FEB-2027',
    'Delta_D:03-FEB-2027*D:17-MAR-2027',
    'Delta_H27',
    'Delta_M27',
    'Delta_U27',
    'Delta_Z27',
    'Delta_H28',
    'Delta_5Y',
    'Delta_10Y',
    'Delta_30Y',
    'SS_0M+2Y',
    'SS_0M+5Y',
    'SS_0M+10Y',
    'SS_0M+30Y',
    'SS_0M+OAT',
    'SS_0M+BTP',
    'X_30Y-50Y',
    'X_7Y',
    'X_20Y',
    'X_60Y',
    'Y_3Y',
    'Y_15Y',
    'Y_25Y',
    'Y_40Y',
    'Z_M28',
    'Z_U28',
    'Z_Z28',
    'Z_H29',
    'Z_4Y',
    'Z_6Y',
    'Z_8Y',
  ];

  private readonly seedValues: number[] = [
    3, 1, 13, -10, -61, -64, -111, -96, -72, -105, -187, -145, -123, -101, -51, -543, 2886, -153,
    0, -534, 2630, -169, 0, 0, 16, 1320, -219, -55, -387, -339, 11, 11, -139, 29, 2, -59, 198,
    -66, 452,
  ];

  fetchRiskPositions(viewType: RiskViewType = 'risk-position'): Observable<RiskPositionApiResponse> {
    return timer(300).pipe(map(() => this.generateResponse(viewType, this.seedValues)));
  }

  refreshInputs(viewType: RiskViewType = 'risk-position'): Observable<RiskPositionApiResponse> {
    const varied = this.seedValues.map(
      (v) => v + Math.round((Math.random() - 0.5) * 20),
    );
    return timer(300).pipe(map(() => this.generateResponse(viewType, varied)));
  }

  private generateResponse(viewType: RiskViewType, values: number[]): RiskPositionApiResponse {
    const columns = this.columnsByView[viewType];
    const rows: RiskPositionRow[] = this.tenors.map((tenor, i) => {
      const base = values[i] ?? 0;

      if (viewType === 'pnl-attribution') {
        return {
          qualifiedTenor: tenor,
          dailyPnl: base,
          mtdPnl: base * 12,
          ytdPnl: base * 47,
          delta: Math.round(base * 0.3),
          gamma: Math.round(base * 0.01),
          vega: Math.round(base * 0.15),
          theta: Math.round(base * -0.05),
        } as RiskPositionRow;
      }

      return {
        qualifiedTenor: tenor,
        reflexPosition: base,
        manualAdjustment: 0,
        adjustedReflexPosition: base,
        targetPosition: 0,
        adjustedEPosition: base,
      };
    });

    const status: RiskPositionStatus = {
      mmuDirection: 'Long',
      snapshotTime: '13:50:09 [00:01:02 since last update]',
      lastPublishTime: '27 Nov, 14:35:29 [2879:15:42 since last update]',
      lastPublishedBy: 'f13920',
      comment: viewType === 'pnl-attribution' ? 'P&L Snapshot' : 'Reflex Publish',
    };

    return { columns: [...columns], rows, status };
  }
}
