import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import type {
  ColDef,
  GridReadyEvent,
  CellValueChangedEvent,
  GridApi,
  RowClassParams,
} from 'ag-grid-community';
import { themeQuartz } from 'ag-grid-community';
import type {
  RiskPositionColumnMeta,
  RiskPositionMultipliers,
  RiskPositionRow,
} from '../../models/risk-position.model';

@Component({
  selector: 'app-risk-position-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgGridAngular],
  template: `
    <ag-grid-angular
      class="risk-grid"
      [theme]="theme"
      [rowData]="rows()"
      [columnDefs]="columnDefs()"
      [defaultColDef]="defaultColDef"
      [getRowStyle]="getRowStyle"
      [suppressMovableColumns]="true"
      [suppressCellFocus]="false"
      (gridReady)="onGridReady($event)"
      (cellValueChanged)="onCellValueChanged($event)"
    />
  `,
  styles: `
    :host {
      display: block;
      flex: 1;
      min-height: 0;
    }

    .risk-grid {
      width: 100%;
      height: 100%;
    }
  `,
})
export class RiskPositionGridComponent {
  readonly columns = input.required<RiskPositionColumnMeta[]>();
  readonly rows = input.required<RiskPositionRow[]>();
  readonly multipliers = input.required<RiskPositionMultipliers>();

  readonly cellValueChanged = output<CellValueChangedEvent>();

  readonly theme = themeQuartz;
  private gridApi: GridApi | null = null;

  readonly defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    suppressHeaderMenuButton: true,
  };

  readonly columnDefs = computed<ColDef[]>(() => {
    const cols = this.columns();
    const m = this.multipliers();

    return cols.map((col) => {
      const def: ColDef = {
        field: col.field,
        headerName: col.headerName,
        editable: col.editable ?? false,
        minWidth: col.field === 'qualifiedTenor' ? 280 : 180,
        flex: 1,
      };

      if (col.type === 'numeric') {
        def.type = 'rightAligned';
        def.valueFormatter = (params) =>
          params.value != null ? Number(params.value).toLocaleString() : '';
      }

      if (col.field === 'adjustedReflexPosition') {
        def.editable = false;
        def.valueGetter = (params) => {
          const reflex = (params.data?.['reflexPosition'] as number) ?? 0;
          const manual = (params.data?.['manualAdjustment'] as number) ?? 0;
          return reflex * m.reflexPositionMultiplier + manual * m.manualAdjustmentMultiplier;
        };
      }

      if (col.field === 'adjustedEPosition') {
        def.editable = false;
        def.valueGetter = (params) => {
          const reflex = (params.data?.['reflexPosition'] as number) ?? 0;
          const manual = (params.data?.['manualAdjustment'] as number) ?? 0;
          const target = (params.data?.['targetPosition'] as number) ?? 0;
          const adjusted =
            reflex * m.reflexPositionMultiplier + manual * m.manualAdjustmentMultiplier;
          return adjusted - target * m.targetPositionMultiplier;
        };
      }

      return def;
    });
  });

  readonly getRowStyle = (params: RowClassParams) => {
    if (params.node.rowIndex != null && params.node.rowIndex % 2 === 0) {
      return { background: '#dce6f5' };
    }
    return { background: '#eaf1fa' };
  };

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    event.api.sizeColumnsToFit();
  }

  onCellValueChanged(event: CellValueChangedEvent): void {
    this.cellValueChanged.emit(event);
  }

  exportCsv(): void {
    this.gridApi?.exportDataAsCsv({ fileName: 'risk-positions.csv' });
  }
}
