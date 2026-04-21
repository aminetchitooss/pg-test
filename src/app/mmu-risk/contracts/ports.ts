import type { Observable } from 'rxjs';
import type {
  ExportPositionsResult,
  InventoryItem,
  MmuInputsResult,
  MmuRiskResult,
  MmuUserMappingsResult,
  PositionTargetItem,
  ReportV4Request,
} from './model';

export interface MmuRiskApiPort {
  getUserMappings(params: { userId: string }): Observable<MmuUserMappingsResult>;
  getRisk(params: {
    mmuName: string;
    spreadCurves: string[];
    reportV4Request: ReportV4Request;
  }): Observable<MmuRiskResult>;
  getInputs(params: { mmuName: string }): Observable<MmuInputsResult>;
  exportPositions(params: {
    mmuName: string;
    userId: string;
    inventory: InventoryItem[];
    positionTargets: PositionTargetItem[];
  }): Observable<ExportPositionsResult>;
}
