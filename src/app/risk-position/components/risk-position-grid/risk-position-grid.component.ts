import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import type {
  ColDef,
  GridReadyEvent,
  CellValueChangedEvent,
  GridApi,
  SizeColumnsToFitGridStrategy,
} from 'ag-grid-community';
import { appGridTheme } from '../../../shared/grid/grid-theme';
import type {
  RiskPositionColumnMeta,
  RiskPositionMultipliers,
  RiskPositionRow,
} from '../../models/risk-position.model';
import {
  computeAdjustedReflexPosition,
  computeAdjustedEPosition,
} from '../../utils/risk-calculations';

const EVEN_ROW_COLOR = '#dce6f5';
const ODD_ROW_COLOR = '#eaf1fa';
const EDITABLE_EVEN_COLOR = '#fdf6e3';
const EDITABLE_ODD_COLOR = '#fef9ec';

@Component({
  selector: 'app-risk-position-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgGridAngular],
  template: `
    <ag-grid-angular
      class="risk-grid"
      aria-label="Risk position data"
      [theme]="theme"
      [rowData]="rows()"
      [columnDefs]="columnDefs()"
      [defaultColDef]="defaultColDef"
      [suppressMovableColumns]="true"
      [suppressCellFocus]="false"
      [autoSizeStrategy]="autoSizeStrategy"
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

      --ag-background-color: #dce6f5;
      --ag-odd-row-background-color: #eaf1fa;
      --ag-row-height: 26px;
      --ag-header-height: 30px;
      --ag-font-size: 12px;
      --ag-border-color: #c8d0dc;
      --ag-row-border-color: #d4dce8;
      --ag-header-foreground-color: #1a1a1a;
      --ag-header-background-color: #f0f0f0;
    }
  `,
})
export class RiskPositionGridComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly columns = input.required<RiskPositionColumnMeta[]>();
  readonly rows = input.required<RiskPositionRow[]>();
  readonly multipliers = input.required<RiskPositionMultipliers>();

  readonly cellValueChanged = output<CellValueChangedEvent>();

  readonly theme = appGridTheme;
  private gridApi: GridApi | null = null;

  readonly defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    suppressHeaderMenuButton: true,
  };

  readonly autoSizeStrategy: SizeColumnsToFitGridStrategy = {
    type: 'fitGridWidth',
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
        def.cellStyle = (params) => {
          const isOdd = (params.node.rowIndex ?? 0) % 2 !== 0;
          const base: Record<string, string> = { textAlign: 'right' };
          if (col.editable) {
            base['backgroundColor'] = isOdd ? EDITABLE_ODD_COLOR : EDITABLE_EVEN_COLOR;
          }
          return base;
        };
        def.valueFormatter = (params) =>
          params.value != null ? Number(params.value).toLocaleString() : '';
      } else if (col.editable) {
        def.cellStyle = (params) => {
          const isOdd = (params.node.rowIndex ?? 0) % 2 !== 0;
          return { backgroundColor: isOdd ? EDITABLE_ODD_COLOR : EDITABLE_EVEN_COLOR };
        };
      }

      if (col.field === 'adjustedReflexPosition') {
        def.editable = false;
        def.valueGetter = (params) =>
          params.data ? computeAdjustedReflexPosition(params.data as RiskPositionRow, m) : 0;
      }

      if (col.field === 'adjustedEPosition') {
        def.editable = false;
        def.valueGetter = (params) =>
          params.data ? computeAdjustedEPosition(params.data as RiskPositionRow, m) : 0;
      }

      return def;
    });
  });

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.destroyRef.onDestroy(() => {
      this.gridApi = null;
    });
  }

  onCellValueChanged(event: CellValueChangedEvent): void {
    this.cellValueChanged.emit(event);
  }

  exportCsv(): void {
    this.gridApi?.exportDataAsCsv({ fileName: 'risk-positions.csv' });
  }
}
