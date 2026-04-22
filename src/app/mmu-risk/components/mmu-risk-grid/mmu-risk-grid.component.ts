import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
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
  ValueGetterParams,
} from 'ag-grid-community';
import { appGridTheme } from '../../../shared/grid/grid-theme';
import type { MergedRow, MmuMultipliers } from '../../models/model';

const BLUE_BG = '#87cefa';
const YELLOW_BG = '#fafad2';
const WHITE_BG = '#ffffff';

const numericFormatter = (params: { value: unknown }): string =>
  params.value != null && Number.isFinite(Number(params.value))
    ? Number(params.value).toLocaleString(undefined, { maximumFractionDigits: 6 })
    : '';

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

    .mmu-grid {
      width: 100%;
      height: 100%;

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
  readonly multipliers = input.required<MmuMultipliers>();
  readonly cellValueChanged = output<CellValueChangedEvent<MergedRow>>();

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

  readonly columnDefs = computed<ColDef<MergedRow>[]>(() => {
    const m = this.multipliers();
    const numericCell = (bg: string) => ({ backgroundColor: bg, textAlign: 'right' });

    return [
      {
        field: 'tenor' as const,
        headerName: 'Tenor',
        editable: false,
        minWidth: 280,
        flex: 1,
        cellStyle: { backgroundColor: BLUE_BG },
      },
      {
        field: 'reflexPosition' as const,
        headerName: 'Reflex Position',
        editable: false,
        minWidth: 180,
        flex: 1,
        cellStyle: numericCell(BLUE_BG),
        valueFormatter: numericFormatter,
        valueGetter: (p: ValueGetterParams<MergedRow>) =>
          (p.data?.reflexPosition ?? 0) * m.reflexPositionMultiplier,
      },
      {
        field: 'manualAdjustment' as const,
        headerName: 'Manual Adjustment',
        editable: true,
        minWidth: 180,
        flex: 1,
        cellStyle: numericCell(WHITE_BG),
        valueFormatter: numericFormatter,
        // Editor opens with the RAW value (no multiplier) — see header doc above.
        valueGetter: (p: ValueGetterParams<MergedRow>) => p.data?.manualAdjustment ?? 0,
      },
      {
        colId: 'adjustedReflexPosition',
        headerName: 'Adjusted Reflex Position',
        editable: false,
        minWidth: 180,
        flex: 1,
        cellStyle: numericCell(YELLOW_BG),
        valueFormatter: numericFormatter,
        valueGetter: (p: ValueGetterParams<MergedRow>) =>
          (p.data?.reflexPosition ?? 0) * m.reflexPositionMultiplier +
          (p.data?.manualAdjustment ?? 0) * m.manualAdjustmentMultiplier,
      },
      {
        field: 'targetPosition' as const,
        headerName: 'Target Position',
        editable: true,
        minWidth: 180,
        flex: 1,
        cellStyle: numericCell(WHITE_BG),
        valueFormatter: numericFormatter,
        valueGetter: (p: ValueGetterParams<MergedRow>) => p.data?.targetPosition ?? 0,
      },
      {
        colId: 'adjustedEPosition',
        headerName: 'Adjusted E-Position',
        editable: false,
        minWidth: 180,
        flex: 1,
        cellStyle: numericCell(YELLOW_BG),
        valueFormatter: numericFormatter,
        valueGetter: (p: ValueGetterParams<MergedRow>) =>
          (p.data?.reflexPosition ?? 0) * m.reflexPositionMultiplier +
          (p.data?.targetPosition ?? 0) * m.targetPositionMultiplier,
      },
    ];
  });

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
