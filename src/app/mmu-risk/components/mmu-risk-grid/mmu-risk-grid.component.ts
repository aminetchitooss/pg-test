import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
} from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import type {
  CellValueChangedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  SizeColumnsToFitGridStrategy,
} from 'ag-grid-community';
import { appGridTheme } from '../../../shared/grid/grid-theme';
import type { MergedRow } from '../../contracts/model';

const EDITABLE_EVEN_COLOR = '#fdf6e3';
const EDITABLE_ODD_COLOR = '#fef9ec';

function editableCellStyle(params: { node: { rowIndex: number | null } }): Record<string, string> {
  const isOdd = (params.node.rowIndex ?? 0) % 2 !== 0;
  return {
    textAlign: 'right',
    backgroundColor: isOdd ? EDITABLE_ODD_COLOR : EDITABLE_EVEN_COLOR,
  };
}

const numericFormatter = (params: { value: unknown }): string =>
  params.value != null ? Number(params.value).toLocaleString() : '';

const COLUMN_DEFS: ColDef<MergedRow>[] = [
  {
    field: 'tenor',
    headerName: 'Tenor',
    editable: false,
    minWidth: 280,
    flex: 1,
  },
  {
    field: 'reflexPosition',
    headerName: 'Reflex Position',
    editable: true,
    minWidth: 180,
    flex: 1,
    cellStyle: editableCellStyle,
    valueFormatter: numericFormatter,
  },
  {
    field: 'manualAdjustment',
    headerName: 'Manual Adjustment',
    editable: true,
    minWidth: 180,
    flex: 1,
    cellStyle: editableCellStyle,
    valueFormatter: numericFormatter,
  },
  {
    field: 'adjustedReflexPosition',
    headerName: 'Adjusted Reflex Position',
    editable: true,
    minWidth: 180,
    flex: 1,
    cellStyle: editableCellStyle,
    valueFormatter: numericFormatter,
  },
  {
    field: 'targetPosition',
    headerName: 'Target Position',
    editable: true,
    minWidth: 180,
    flex: 1,
    cellStyle: editableCellStyle,
    valueFormatter: numericFormatter,
  },
  {
    field: 'adjustedEPosition',
    headerName: 'Adjusted E-Position',
    editable: true,
    minWidth: 180,
    flex: 1,
    cellStyle: editableCellStyle,
    valueFormatter: numericFormatter,
  },
];

@Component({
  selector: 'app-mmu-risk-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgGridAngular],
  template: `
    <ag-grid-angular
      class="mmu-grid"
      aria-label="MMU risk data"
      [theme]="theme"
      [rowData]="rows()"
      [columnDefs]="columnDefs"
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

    .mmu-grid {
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
export class MmuRiskGridComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly rows = input.required<MergedRow[]>();
  readonly cellValueChanged = output<CellValueChangedEvent<MergedRow>>();

  readonly theme = appGridTheme;
  readonly columnDefs = COLUMN_DEFS;
  private gridApi: GridApi | null = null;

  readonly defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    suppressHeaderMenuButton: true,
  };

  readonly autoSizeStrategy: SizeColumnsToFitGridStrategy = {
    type: 'fitGridWidth',
  };

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.destroyRef.onDestroy(() => {
      this.gridApi = null;
    });
  }

  onCellValueChanged(event: CellValueChangedEvent<MergedRow>): void {
    this.cellValueChanged.emit(event);
  }
}
