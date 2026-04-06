import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import type {
  ColDef,
  GridReadyEvent,
  CellValueChangedEvent,
  SelectionChangedEvent,
  GridApi,
  StatusPanelDef,
  SideBarDef,
} from 'ag-grid-community';
import { themeQuartz } from 'ag-grid-community';

interface RowData {
  id: number;
  name: string;
  language: string;
  stars: number;
  forks: number;
  license: string;
  updated: string;
}

@Component({
  selector: 'app-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgGridAngular],
  template: `
    <div class="grid-wrapper">
      <div class="grid-toolbar">
        <h2 id="grid-heading">AG Grid Enterprise Demo</h2>
        <div class="grid-actions">
          <button (click)="addRow()" class="btn">Add Row</button>
          <button (click)="removeSelected()" [disabled]="selectedRows().length === 0" class="btn">
            Remove Selected ({{ selectedRows().length }})
          </button>
          <button (click)="exportCsv()" class="btn">Export CSV</button>
        </div>
      </div>

      <ag-grid-angular
        class="grid"
        [theme]="theme"
        aria-labelledby="grid-heading"
        [rowData]="rowData()"
        [columnDefs]="columnDefs"
        [defaultColDef]="defaultColDef"
        [rowSelection]="rowSelection"
        [sideBar]="sideBar"
        [statusBar]="statusBar"
        [enableRangeSelection]="true"
        [enableCharts]="true"
        [animateRows]="true"
        [pagination]="true"
        [paginationPageSize]="10"
        [paginationPageSizeSelector]="[5, 10, 25, 50]"
        (gridReady)="onGridReady($event)"
        (cellValueChanged)="onCellValueChanged($event)"
        (selectionChanged)="onSelectionChanged($event)"
      />
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .grid-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 16px;
    }

    .grid-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }

    .grid-toolbar h2 {
      margin: 0;
      font-size: 1.25rem;
    }

    .grid-actions {
      display: flex;
      gap: 8px;
    }

    .btn {
      padding: 6px 14px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #fff;
      cursor: pointer;
      font-size: 0.875rem;
      transition: background 0.15s;

      &:hover:not(:disabled) {
        background: #f3f4f6;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .grid {
      flex: 1;
      width: 100%;
      min-height: 500px;
    }
  `,
})
export class GridComponent {
  private gridApi: GridApi | null = null;
  private nextId = 8;

  readonly theme = themeQuartz;

  readonly rowData = signal<RowData[]>([
    { id: 1, name: 'Angular', language: 'TypeScript', stars: 98200, forks: 26100, license: 'MIT', updated: '2026-04-01' },
    { id: 2, name: 'React', language: 'JavaScript', stars: 231000, forks: 47200, license: 'MIT', updated: '2026-04-03' },
    { id: 3, name: 'Vue', language: 'TypeScript', stars: 208000, forks: 33700, license: 'MIT', updated: '2026-04-02' },
    { id: 4, name: 'Svelte', language: 'JavaScript', stars: 80500, forks: 4200, license: 'MIT', updated: '2026-03-28' },
    { id: 5, name: 'Next.js', language: 'TypeScript', stars: 129000, forks: 27500, license: 'MIT', updated: '2026-04-05' },
    { id: 6, name: 'Nuxt', language: 'TypeScript', stars: 55800, forks: 5100, license: 'MIT', updated: '2026-04-04' },
    { id: 7, name: 'SolidJS', language: 'TypeScript', stars: 33200, forks: 940, license: 'MIT', updated: '2026-03-30' },
  ]);

  readonly selectedRows = signal<RowData[]>([]);

  readonly selectedCount = computed(() => this.selectedRows().length);

  readonly columnDefs: ColDef<RowData>[] = [
    {
      field: 'id',
      headerName: 'ID',
      width: 80,
      checkboxSelection: true,
      headerCheckboxSelection: true,
    },
    { field: 'name', headerName: 'Project', editable: true, filter: 'agTextColumnFilter' },
    {
      field: 'language',
      headerName: 'Language',
      editable: true,
      filter: 'agSetColumnFilter',
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: {
        values: ['TypeScript', 'JavaScript', 'Rust', 'Go', 'Python'],
      },
    },
    {
      field: 'stars',
      headerName: 'Stars',
      filter: 'agNumberColumnFilter',
      valueFormatter: (params) => params.value?.toLocaleString() ?? '',
      enableValue: true,
      aggFunc: 'sum',
    },
    {
      field: 'forks',
      headerName: 'Forks',
      filter: 'agNumberColumnFilter',
      valueFormatter: (params) => params.value?.toLocaleString() ?? '',
      enableValue: true,
      aggFunc: 'sum',
    },
    { field: 'license', headerName: 'License', filter: 'agSetColumnFilter' },
    {
      field: 'updated',
      headerName: 'Last Updated',
      filter: 'agDateColumnFilter',
      sort: 'desc',
    },
  ];

  readonly defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    floatingFilter: true,
    enableRowGroup: true,
    enablePivot: true,
  };

  readonly rowSelection: 'single' | 'multiple' = 'multiple';

  readonly sideBar: SideBarDef = {
    toolPanels: [
      {
        id: 'columns',
        labelDefault: 'Columns',
        labelKey: 'columns',
        iconKey: 'columns',
        toolPanel: 'agColumnsToolPanel',
      },
      {
        id: 'filters',
        labelDefault: 'Filters',
        labelKey: 'filters',
        iconKey: 'filter',
        toolPanel: 'agFiltersToolPanel',
      },
    ],
    defaultToolPanel: '',
  };

  readonly statusBar: { statusPanels: StatusPanelDef[] } = {
    statusPanels: [
      { statusPanel: 'agTotalAndFilteredRowCountComponent', align: 'left' },
      { statusPanel: 'agSelectedRowCountComponent', align: 'left' },
      { statusPanel: 'agAggregationComponent', align: 'right' },
    ],
  };

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    event.api.sizeColumnsToFit();
  }

  onCellValueChanged(event: CellValueChangedEvent<RowData>): void {
    this.rowData.update((rows) =>
      rows.map((row) => (row.id === event.data?.id ? { ...row, ...event.data } : row)),
    );
  }

  onSelectionChanged(event: SelectionChangedEvent<RowData>): void {
    this.selectedRows.set(event.api.getSelectedRows());
  }

  addRow(): void {
    const id = this.nextId++;
    const newRow: RowData = {
      id,
      name: `New Project ${id}`,
      language: 'TypeScript',
      stars: 0,
      forks: 0,
      license: 'MIT',
      updated: new Date().toISOString().split('T')[0],
    };
    this.rowData.update((rows) => [...rows, newRow]);
  }

  removeSelected(): void {
    const selectedIds = new Set(this.selectedRows().map((r) => r.id));
    this.rowData.update((rows) => rows.filter((r) => !selectedIds.has(r.id)));
    this.selectedRows.set([]);
  }

  exportCsv(): void {
    this.gridApi?.exportDataAsCsv();
  }
}
