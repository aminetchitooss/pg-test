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

      --ag-odd-row-background-color: var(--app-grid-odd-row, #eaf1fa);
      --ag-row-background-color: var(--app-grid-even-row, #dce6f5);
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
        def.type = 'rightAligned';
        def.valueFormatter = (params) =>
          params.value != null ? Number(params.value).toLocaleString() : '';
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
