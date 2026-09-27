import {
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellClassParams,
  ColumnMovedEvent,
  ColumnRowGroupChangedEvent,
  DefaultMenuItem,
  FirstDataRenderedEvent,
  GetContextMenuItemsParams,
  GetRowIdFunc,
  GetRowIdParams,
  GridApi,
  GridOptions,
  GridReadyEvent,
  GroupCellRendererParams,
  IRowNode,
  MenuItemDef,
  RowGroupOpenedEvent,
  SideBarDef,
  SizeColumnsToContentStrategy,
  StateUpdatedEvent,
} from 'ag-grid-community';
import { asapScheduler, Subject, switchMap, throttleTime } from 'rxjs';
import { CreditQueryTextSubstitutionFormComponent } from 'src/app/credit/components/credit-query-text-substitution-form/credit-query-text-substitution-form.component';
import { CreditGridState } from 'src/app/credit/interfaces/credit-grid-state.interface';
import { GRID_MODE, GridMode } from 'src/shared/grid-mode/grid-mode';
import { GridModeService } from 'src/shared/grid-mode/grid-mode.service';
import { GridModeGridDirective } from 'src/shared/grid-mode/grid-mode-grid.directive';
import { GridModeSelectComponent } from 'src/shared/grid-mode/grid-mode-select.component';
import { CreditGridDataService } from 'src/app/credit/services/credit-grid-data/credit-grid-data.service';
import { GridAdvancedFilterService } from 'src/shared/grid-advanced-filter/grid-advanced-filter.service';
import { AdvancedFilterGridDirective } from 'src/shared/grid-advanced-filter/advanced-filter-grid.directive';
import { ADVANCED_FILTER_GRID_OPTIONS } from 'src/shared/grid-advanced-filter/advanced-filter-grid-options';
import {
  CreditPrestoQueryDataService,
  QueryKeys,
} from 'src/app/credit/services/credit-presto-query-data/credit-presto-query-data.service';
import { CreditUserSettingsService } from 'src/app/credit/services/credit-user-settings/credit-user-settings.service';
import { WarningDialogComponent } from 'src/shared/dialogs/warning/warning-dialog.component';
import { createAggFuncs, withoutAggFunc } from 'src/shared/grid-aggregation/grid-aggregation';
import { SummaryBarValues } from 'src/shared/interfaces/risk-pivot-grid.interface';
import { WarningDialogData } from 'src/shared/interfaces/warning-dialog.interface';
import { AuthenticationService } from 'src/shared/services/authentication/authentication.service';
import { ConfigService } from 'src/shared/services/config/config.service';
import { DynatraceService } from 'src/shared/services/dynatrace/dynatrace.service';
import { FullScreenService } from 'src/shared/services/full-screen/full-screen.service';
import { AgGridToolsService } from 'src/shared/services/utility-services/ag-grid-tools.service';
import { CreditData } from '../../models/credit-data.model';
import { CreditDataService } from '../../services/credit-data/credit-data.service';
import { CreditQueryInputService } from '../../services/credit-query-input/credit-query-input.service';
import { AsyncPipe, DecimalPipe, NgStyle } from '@angular/common';
import { AuthenticationInfoComponent } from 'src/shared/components/leader-info/authentication-info.component';
import { LeaderInitializerService } from 'src/shared/services/config/leader-initializer.service';
import { TradesInfoComponent } from 'src/shared/components/trades-info/trades-info.component';
import {
  SidePanelAction,
  SidePanelService,
} from 'src/shared/services/side-panel/side-panel.service';
import {
  MissingRisk,
  MissingRiskPivotField,
} from 'src/shared/interfaces/missing-risk.interface';
import * as _ from 'lodash';
import { MissingRiskSubValuePipe } from 'src/app/risk-view/pipes/missing-risk-sub-value/missing-risk-sub-value.pipe';
import { LayoutService } from 'src/shared/services/layout/layout.service';
import { CreditLayoutService } from '../../services/credit-layout-service/credit-layout.service';

// Column-event sources that mean "the user did it".
// e.g. clicking a header to sort -> source 'uiColumnSorted' (in this set),
// restoring saved state via applyColumnState -> source 'api' (not in this set).
const USER_COLUMN_SOURCES = new Set<string>([
  'uiColumnMoved',
  'uiColumnResized',
  'uiColumnDragged',
  'uiColumnExpanded',
  'uiColumnSorted',
  'toolPanelUi',
  'toolPanelDragAndDrop',
  'contextMenu',
  'columnMenu',
]);

@Component({
  selector: 'credit-grid',
  imports: [
    AsyncPipe,
    AgGridAngular,
    MatIcon,
    MatButton,
    MatIconButton,
    MatTooltip,
    FormsModule,
    CreditQueryTextSubstitutionFormComponent,
    DecimalPipe,
    AuthenticationInfoComponent,
    NgStyle,
    MissingRiskSubValuePipe,
    AdvancedFilterGridDirective,
    GridModeGridDirective,
    GridModeSelectComponent,
  ],
  templateUrl: './credit-grid.component.html',
  styleUrl: './credit-grid.component.scss',
})
export class CreditGridComponent {
  fullScreenService = inject(FullScreenService);
  queryInputService = inject(CreditQueryInputService);
  gridToolsService = inject(AgGridToolsService);
  creditGridDataService = inject(CreditGridDataService);
  leaderService = inject(LeaderInitializerService);
  dataService = inject(CreditDataService);
  userSettingsService = inject(CreditUserSettingsService);
  advancedFilterService = inject(GridAdvancedFilterService);
  creditPrestoQueryDataService = inject(CreditPrestoQueryDataService);
  dialog = inject(MatDialog);
  dynatraceService = inject(DynatraceService);
  authenticationService = inject(AuthenticationService);
  configService = inject(ConfigService);
  sidePanelService = inject(SidePanelService);
  cdr = inject(ChangeDetectorRef);
  layoutService = inject(LayoutService);
  creditLayoutService = inject(CreditLayoutService);
  snackBar = inject(MatSnackBar);

  // Pivot (row-grouped) or flat (one row per record). The shared feature owns
  // the mode and the grid rebuild; this component keeps a saved layout per mode
  // and the report-reset plumbing — the same split as the Advanced Filter.
  gridModeService = inject(GridModeService);
  private gridModeGrid = viewChild(GridModeGridDirective);
  // Collapse/expand-all only mean something with row groups: always in pivot,
  // in flat only once something was dragged into the group panel.
  protected showGroupButtons = computed(
    () => !this.gridModeService.isFlat() || (this.gridModeGrid()?.flatRowGroupCount() ?? 0) > 0,
  );

  protected isAdmin: boolean = this.authenticationService.isAdmin();
  protected gridApi?: GridApi;
  protected rowData: CreditData[] = [];
  private showTrades = false;
  private rowIdCache: Set<number | string> = new Set<number | string>();
  private firstSet = true;
  showMissingRisk = false;
  flashUpdate: boolean = false;
  riskDiff: MissingRiskPivotField[] = [];
  firstRisk: boolean = true;
  riskDiffNumber: number = 0;
  missingRisk: MissingRisk = <MissingRisk>{};
  currentMissingRisk: MissingRisk = <MissingRisk>{};
  activePivotRiskId: number = 0;
  totalPivotRiskFields: number = 0;
  protected summaryBar: SummaryBarValues = {
    rangeSum: 0,
    rangeCount: 0,
  };

  protected gridOptions: GridOptions<CreditData> = {
    groupDisplayType: 'custom',
    groupHideOpenParents: true,
    suppressDragLeaveHidesColumns: true,
    suppressAggFuncInHeader: true,
    suppressRowTransform: true,
    allowContextMenuWithControlKey: true,
    grandTotalRow: 'bottom',
    cellSelection: true,
    groupTotalRow: ({ node }) => {
      if (node && node.childrenAfterFilter && node.childrenAfterFilter.length > 1) return 'bottom';
      return undefined;
    },
    defaultColDef: {
      sortable: true,
      lockPinned: true,
      cellClassRules: {
        'subtotal-group': ({ node }: CellClassParams) =>
          node.level > -1 && node.footer == true,
      },
    },
    getContextMenuItems: (params) => this.buildContextMenuItems(params),
    // The Advanced Filter feature itself is turned on/off by the
    // advancedFilterGrid directive; these are its init-only options.
    ...ADVANCED_FILTER_GRID_OPTIONS,
  };

  protected sideBar: SideBarDef = {
    toolPanels: [
      {
        id: 'columns',
        labelDefault: 'Columns',
        labelKey: 'columns',
        iconKey: 'columns',
        toolPanel: 'agColumnsToolPanel',
        toolPanelParams: {
          suppressPivotMode: true,
          suppressValues: true,
        },
      },
      'filters',
    ],
    defaultToolPanel: undefined,
  };

  protected aggFuncs = {
    grandTotalAgg: (params: any) => {
      if (params.rowNode?.allLeafChildren) {
        return params.rowNode?.allLeafChildren?.reduce(
          (total: number, obj: any) => obj.data.PV01 + total,
          0,
        );
      }
      return params.rowNode?.data.PV01;
    },
    ...createAggFuncs(),
  };

  protected autoGroupColumnDef = {
    cellRendererParams: {
      suppressCount: true,
      totalValueGetter: (params: GroupCellRendererParams) =>
        params.node.level === -1 ? 'Grand Total' : `${params.node.key || '(Blanks)'} Total`,
    },
    cellClass: 'cell-in-row-group',
  };

  protected columnTypes = {
    customRowGroup: {
      ...this.autoGroupColumnDef,
      cellRenderer: 'agGroupCellRenderer',
      hide: true,
    },
    customRowGroupField: {
      rowGroup: true,
      enableRowGroup: true,
      hide: true,
      // Make these hidden dimension columns filterable so ag-grid's Advanced
      // Filter can target them (it ignores columns with no filter).
      filter: 'agTextColumnFilter',
    },
  };

  protected autoSizeStrategy: SizeColumnsToContentStrategy = {
    type: 'fitCellContents',
    skipHeader: false,
  };

  // True once the user changes the grid (sort, resize, expand...). Until then
  // onStateUpdated saves nothing, so init/restore can never show "Save Settings".
  private userHasInteracted = false;
  private triggerSettingsUpdate$ = new Subject<void>();
  protected resetWarning = signal(false);

  // "New" badge on the Filters button until it's used once — e.g. dismissed
  // forever after the first click, whatever the toggle direction.

  constructor() {
    this.triggerSettingsUpdate$
      .pipe(
        takeUntilDestroyed(),
        throttleTime(2000, undefined, { leading: true, trailing: true }),
        switchMap(() => this.userSettingsService.updateUserSettings()),
      )
      .subscribe();

    this.sidePanelService.component$.pipe(takeUntilDestroyed()).subscribe((target) => {
      if (target.id === 'trades') {
        this.showTrades = target.action === SidePanelAction.OPEN;
      }
    });

    effect(() => {
      this.dataService.store.initialFetchStartedAt();
      this.dataService.store.lastFetchStartedAt();
      this.firstSet = true;
    });

    effect(() => {
      this.dataService.store.lastUpdate();
      untracked(() => {
        const data = this.dataService.store.preSortedCreditEntities();
        this.updateData(data, !this.firstSet);
        this.firstSet = false;
      });
    });

    // Credit's settings glue for the shared Advanced Filter: mirror the filter
    // model into credit's user settings so Save persists it. Only while the
    // feature is on — a disabled filter keeps the last saved model, so
    // re-enabling restores it.
    effect(() => {
      const model = this.advancedFilterService.model();
      if (!this.advancedFilterService.enabled()) return;
      untracked(() => {
        this.queryInputService.userSettings.advancedFilterModel = model;
      });
    });

    effect(() => {
      let missingRisk = this.dataService.store.computeMissing();
      if (missingRisk && missingRisk.missingRiskPivotFields.length === 0) {
        this.resetMissingRisk();
        this.showMissingRisk = false;
      } else {
        this.processMissingRisk(missingRisk);
        this.showMissingRisk = true;
      }
    });
  }

  public getRowId: GetRowIdFunc = (params: GetRowIdParams) =>
    params.data.uniqueKey.toString();

  public onGridReady($event: GridReadyEvent<any>) {
    this.gridApi = $event.api;
  }

  public onFirstDataRendered($event: FirstDataRenderedEvent<any>) {
    this.gridApi?.sizeColumnsToFit();

    // Read first: shouldGridStateReset() can seed a fresh saved state, which
    // pushes the pristine column defs back in and would undo a flat layout.
    const shouldReset = this.shouldGridStateReset();
    if (this.gridModeService.isFlat()) this.gridModeGrid()?.applyFlatLayout();

    if (shouldReset) {
      this.logTrace('[RESET]', 'Opening reset dialog ');
      this.openReportChangedDisclosureModal();
    } else {
      this.restoreGridState();
    }

  }

  processMissingRisk(missingRisk: MissingRisk) {
    if (missingRisk.reset || missingRisk.totalMissingRisk === 0) {
      this.resetMissingRisk();
    }

    if (missingRisk.totalMissingRisk) {
      if (this.firstRisk) {
        this.missingRisk = missingRisk;
        this.currentMissingRisk.totalMissingRisk = 0;
        this.currentMissingRisk.missingRiskPivotFields = [];
        this.firstRisk = false;
        this.setActivePivotIdToPositionType();
      }

      this.missingRisk = missingRisk;

      if (
        missingRisk.missingRiskPivotFields &&
        missingRisk.missingRiskPivotFields.length
      ) {
        this.riskDiff = _.difference(
          missingRisk.missingRiskPivotFields,
          this.currentMissingRisk.missingRiskPivotFields,
        );
        this.riskDiffNumber =
          missingRisk.totalMissingRisk - this.currentMissingRisk.totalMissingRisk;

        this.flashUpdate = true;

        setTimeout(() => {
          this.flashUpdate = false;
        }, 500);

        this.currentMissingRisk = _.cloneDeep(this.missingRisk);
      }

      this.totalPivotRiskFields = this.missingRisk.missingRiskPivotFields.length;
      this.cdr.detectChanges();
    }
  }

  resetMissingRisk() {
    this.firstRisk = true;
    this.missingRisk = <MissingRisk>{};
    this.currentMissingRisk = <MissingRisk>{};
    this.activePivotRiskId = 0;
    this.riskDiff = [];
    this.totalPivotRiskFields = 0;
    this.cdr.detectChanges();
  }

  setActivePivotIdToPositionType() {
    if (this.missingRisk && this.missingRisk.missingRiskPivotFields) {
      let pivotFields = this.missingRisk.missingRiskPivotFields;
      let posTypeField = pivotFields.findIndex((i) => i.pivotName === 'Position type');
      if (posTypeField > -1) {
        this.activePivotRiskId = posTypeField;
      }
    }
  }

  openReportChangedDisclosureModal() {
    const dialogRef = this.dialog.open(WarningDialogComponent, {
      width: '400px',
      disableClose: true,
      data: {
        icon: 'warning_amber',
        title: 'Report has changed',
        body: 'There has been changes in the structure of the report (specifically related to keys)',
        bodyWarn: 'We recommend you to reset your display settings',
        showCloseButton: true,
        closeButtonText: 'Ignore',
        showContinueButton: true,
        continueButtonText: 'Reset Display Settings',
        disableQuery: true,
        reset: true,
      } as WarningDialogData,
    });
    dialogRef.afterClosed().subscribe((isResetGrid) => {
      if (isResetGrid) {
        this.logTrace('[RESET]', 'user action - dialog reset settings selected');
        this.resetGridSavedState(true);
        if (this.gridModeService.isFlat()) this.gridModeGrid()?.applyFlatLayout();
      }
      this.resetWarning.set(!isResetGrid);
      console.log(`[USER] POST REPORT_CHANGE : ${isResetGrid ? 'Reset Requested' : 'Ignored'}`);
      this.userSettingsService.updateUserSettings().subscribe();
      this.restoreGridState();
    });
  }

  public onRowGroupOpened($event: RowGroupOpenedEvent<any>) {
    // $event.event is the browser click. Restore calls setExpanded() -> no click.
    if ($event.event) this.userHasInteracted = true;
    if (!this.gridApi) {
      return;
    }

    if ($event.expanded) {
      const nodeChildrenAg = $event.node.childrenAfterGroup;
      if (
        nodeChildrenAg === null ||
        nodeChildrenAg.length === 0 ||
        nodeChildrenAg[0].field === undefined
      ) {
        return;
      }
      this.setColumnVisibility('customRowGroup-' + nodeChildrenAg[0].field, true);
      return;
    }

    if (!$event.node.childrenAfterGroup || !$event.node.parent) {
      return;
    }
    this.collapseAllChildrenRowGroups($event.node.childrenAfterGroup);

    const levelRowGroupsExpanded = this.expandedRowGroupsForLevel($event.node.level);
    if (levelRowGroupsExpanded.length > 0) {
      return;
    }

    const nodeChildrenAg = $event.node.childrenAfterGroup;
    if (
      nodeChildrenAg === null ||
      nodeChildrenAg.length === 0 ||
      nodeChildrenAg[0].field === undefined
    ) {
      return;
    }
    this.setColumnVisibility('customRowGroup-' + nodeChildrenAg[0].field, false);
  }

  public onColumnMoved($event: ColumnMovedEvent<any>) {
    this.onUserGridGesture($event);
    // The clamp below keeps the group placeholders left of the value columns;
    // a flat grid has none, so every column moves freely.
    if (this.gridModeService.isFlat()) return;
    if (!$event.finished || !this.gridApi) {
      return;
    }

    let isGroupCol = true;
    const affectedCol = $event.column?.getColDef();
    if (!affectedCol || typeof affectedCol.showRowGroup !== 'string') {
      isGroupCol = false;
    }

    // NOTE: `lastGroupColIndex = count - 1` is a tight state-index threshold that's only
    // correct after our consolidation logic packs placeholders into positions 0..N-1.
    // If a future change scatters placeholders, this clamp can yank API moves to the
    // wrong slot — re-introduce a `source !== 'api'` guard then.
    const allDisplayed = this.gridApi.getColumns();
    let lastGroupColIndex: number | undefined = undefined;
    if (allDisplayed) {
      const allGroups = allDisplayed
        .filter((col) => typeof col.getColDef().showRowGroup === 'string')
        .map((col) => col.getColId());
      if (allGroups.length > 0) {
        lastGroupColIndex = allGroups.length - 1;
      }
    }

    if (isGroupCol) {
      if (
        lastGroupColIndex !== undefined &&
        $event.toIndex !== undefined &&
        $event.toIndex > lastGroupColIndex
      ) {
        setTimeout(() => {
          if ($event.column) {
            this.gridApi?.moveColumns([$event.column], lastGroupColIndex!);
          }
        });
      }
      const rowGroupCols = this.getRowGroupColumnsOrder();
      const targetOrder = rowGroupCols.map((name, index) => ({
        colId: name.split('-')[1],
        rowGroupIndex: index,
      }));
      this.gridApi?.applyColumnState({ state: targetOrder });
      this.toggleGroupCollapsing(false);
    } else {
      if (
        lastGroupColIndex !== undefined &&
        $event.toIndex !== undefined &&
        $event.toIndex < lastGroupColIndex
      ) {
        setTimeout(() => {
          if ($event.column) {
            this.gridApi?.moveColumns([$event.column], lastGroupColIndex! + 1);
          }
        });
      }
    }
  }

  onColumnRowGroupChanged($event: ColumnRowGroupChangedEvent<any>) {
    this.onUserGridGesture($event);

    // In the flat grid ad-hoc grouping is the gridModeGrid directive's job.
    if (this.gridModeService.isFlat()) return;

    if ($event.source === 'gridInitializing') {
      asapScheduler.schedule(() => {
        this.handleSidebarColumnsVisibility($event.api);
      });
    }

    if ($event.source === 'toolPanelUi') {
      const state = [
        ...$event.api.getRowGroupColumns().map((x, i) => {
          return {
            colId: 'customRowGroup-' + x.getColId(),
          };
        }),
        ...$event.api.getRowGroupColumns().map((x, i) => {
          return {
            colId: x.getColId(),
            rowGroupIndex: i,
          };
        }),
      ];
      this.gridApi?.applyColumnState({ state: state, applyOrder: true });
      this.handleSidebarColumnsVisibility($event.api);
      this.toggleGroupCollapsing(false);
    }
  }

  handleSidebarColumnsVisibility(api: GridApi<any>) {
    const colDefs = api.getColumnDefs();
    colDefs?.forEach((x: any) => {
      if (x.colId.includes('customRowGroup-')) {
        return;
      } else {
        x.suppressColumnsToolPanel = x.rowGroup;
      }
    });
    this.gridApi?.setGridOption('columnDefs', colDefs);
    this.setColumnVisibility(
      'customRowGroup-' + this.gridApi?.getRowGroupColumns()[0].getColId(),
    );
  }

  updateData(inUpdate: CreditData[], applyUpdateAsTransaction = true): void {
    const update = [...inUpdate];

    if (!this.gridApi) {
      if (this.rowData.length === 0) {
        this.rowData = update;
        this.rowData.forEach((x) => this.rowIdCache.add(x.uniqueKey));
      }
      return;
    }

    if (!applyUpdateAsTransaction) {
      this.rowData = update;
      this.gridApi.setGridOption('rowData', this.rowData);
      this.rowIdCache.clear();
      this.rowData.forEach((x) => this.rowIdCache.add(x.uniqueKey));
      return;
    }

    const toUpdate: CreditData[] = [];
    const toAdd: CreditData[] = [];
    update.forEach((updateRow: CreditData, idx) => {
      if (this.rowIdCache.has(updateRow.uniqueKey)) {
        toUpdate.push(updateRow);
      } else {
        toAdd.push(updateRow);
        this.rowIdCache.add(updateRow.uniqueKey);
      }
    });

    this.gridApi.applyTransaction({ add: toAdd, update: toUpdate });
  }

  resetColumns() {
    this.layoutService
      .resetColumns()
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.logTrace('[RESET]', 'user action - reset button clicked');
          this.resetWarning.set(false);
          this.resetGridSavedState();
          this.gridApi?.collapseAll();
          this.gridApi?.resetColumnState();
          if (this.gridModeService.isFlat()) {
            this.gridModeGrid()?.applyFlatLayout();
          } else {
            this.handleSidebarColumnsVisibility(this.gridApi!);
          }
          this.triggerSettingsUpdate$.next();
        }
      });
  }

  toggleGroupCollapsing(expand: boolean) {
    const rowGroupCols = this.getRowGroupColumnsOrder();
    if (expand) {
      this.gridApi?.expandAll();
      rowGroupCols.forEach((x) => this.setColumnVisibility(x, true));
    } else {
      this.gridApi?.collapseAll();
      // Make sure the first row-group column is showing. If the user dragged the
      // visible one somewhere else, the new first one is hidden, and the loop
      // below hides the rest, so nothing would show.
      const first = rowGroupCols.shift();
      if (first) this.setColumnVisibility(first, true);
      rowGroupCols.forEach((x) => this.setColumnVisibility(x, false));
    }
    this.gridApi?.autoSizeAllColumns();
  }

  onCellSelectionChanged() {
    if (!this.gridApi) {
      return;
    }
    this.gridToolsService.updateSummaryBar(this.gridApi, this.summaryBar);
  }

  toggleQueryOverride() {
    this.queryInputService.userSettings.queryOverrideEnabled =
      !this.queryInputService.userSettings.queryOverrideEnabled;
    this.queryInputService.userSettings.gridState = [];

    this.dataService.shouldRetryConnection = true;

    this.userSettingsService.updateUserSettings().subscribe((result) => {
      this.dataService.closeConnectionAndFetch();
    });
  }

  // Marks the grid as user-edited when a column event comes from the UI.
  // e.g. dragging a column -> 'uiColumnMoved' -> flag set.
  //      restore on page load -> 'api' -> ignored.
  protected onUserGridGesture($event: { source?: string }): void {
    if (this.userHasInteracted) return;
    if ($event.source && USER_COLUMN_SOURCES.has($event.source)) {
      this.userHasInteracted = true;
    }
  }

  onStateUpdated($event: StateUpdatedEvent<any>) {
    // Only save after a real user edit. Without this check, restoring saved state
    // on load fires the same events as a user sort and showed a phantom
    // "Save Settings" (worst on background-tab reloads, where events arrive late).
    if (!this.userHasInteracted || this.gridModeGrid()?.applying()) return;

    const currentGridState = this.getCurrentGridSavedStateReference();
    if (!currentGridState) return;
    const sourcesForColChanges = [
      'columnSizing',
      'sort',
      'columnVisibility',
      'aggregation',
      'columnPinning',
      'rowGroup',
      'rowGroupExpansion',
      'columnOrder',
    ];

    if ($event.sources.some((x) => sourcesForColChanges.includes(x))) {
      let currentColState = structuredClone(this.gridApi?.getColumnState());
      const columnOrder = $event.state.columnOrder
        ? $event.state.columnOrder.orderedColIds
        : [];
      if (columnOrder.length) {
        currentColState = currentColState?.sort((a: any, b: any) => {
          return columnOrder.indexOf(a.colId) - columnOrder.indexOf(b.colId);
        });
      }
      if (currentColState) {
        currentGridState.columnState = currentColState;
      }
      currentGridState.mode = this.gridModeService.mode();
      currentGridState.rowGroupExpansion = $event.state.rowGroupExpansion
        ? $event.state.rowGroupExpansion.expandedRowGroupIds
        : [];

      this.triggerSettingsUpdate$.next();
    }

    if ($event.sources[0] === 'rowGroupExpansion') {
      setTimeout(() => {
        this.gridApi?.autoSizeColumns(['ag-Grid-AutoColumn']);
      });
    }
  }

  toggleTradesSidePanel() {
    if (this.showTrades) {
      this.sidePanelService.close('trades');
      return;
    }
    this.sidePanelService.open({
      id: 'trades',
      component: TradesInfoComponent,
    });
  }

  persistSettings() {
    this.userSettingsService.updateUserSettings(undefined, undefined, true).subscribe(() => {
      this.snackBar.open('Your settings have been saved successfully.', 'X');
    });
  }

  private buildContextMenuItems(
    params: GetContextMenuItemsParams<CreditData>,
  ): (DefaultMenuItem | MenuItemDef<CreditData>)[] {
    const defaults = (params.defaultItems ?? []) as (DefaultMenuItem | MenuItemDef<CreditData>)[];
    const drillDown = this.buildDrillDownToMenuItem(params);
    const bringToFront = this.buildBringToFrontMenuItem(params);
    const filterItems = this.advancedFilterService.menuItems(params, () =>
      this.userSettingsService.updateUserSettings().subscribe(),
    );
    const customItems: (DefaultMenuItem | MenuItemDef<CreditData>)[] = [];
    if (drillDown) customItems.push(drillDown);
    if (bringToFront) customItems.push(bringToFront);
    if (filterItems.length) {
      if (customItems.length) customItems.push('separator');
      customItems.push(...filterItems);
    }
    if (customItems.length === 0) return defaults;
    return [...customItems, 'separator', ...defaults];
  }

  /**
   * Add-To-Filter / Add-To-Exclusion for the clicked dimension cell, routed into
   * ag-grid's native Advanced Filter. e.g. right-clicking a 'JPM' Issuer cell adds
   * `Issuer equals JPM` (or `not equal` for exclusion) to the filter model.
   */

  // The grid-side toggle. Same mechanism as the settings-route toggle: write the
  // setting, re-hydrate the service, flag settings unsaved. The saved filter
  // model survives toggling off (the settings-sync effect only mirrors while
  // enabled), so re-enabling restores it.
  protected onToggleGridFilters(enabled: boolean) {
    this.queryInputService.userSettings.advancedFilterEnabled = enabled;
    this.advancedFilterService.hydrate(
      this.queryInputService.userSettings.advancedFilterModel,
      enabled,
    );
    this.userSettingsService.updateUserSettings().subscribe();
  }

  // Credit's settings glue for the shared grid mode, the same shape as the
  // grid-filters toggle: the picker already moved the mode, so just mirror it
  // into the settings and flag them unsaved. The grid rebuild arrives through
  // onGridModeApplied.
  protected onGridModeChange(mode: GridMode) {
    this.queryInputService.userSettings.gridMode = mode;
    this.userSettingsService.updateUserSettings().subscribe();
  }

  // The directive rebuilt the columns for a new mode. Lay credit's own things on
  // top: a fresh saved slot if this mode has none yet (that pushes the pristine
  // defs, so flatten again after it), the collapsed pivot, then the saved layout.
  protected onGridModeApplied(mode: GridMode) {
    if (!this.gridApi) return;
    if (!this.currentGridStateBucket().length) this.resetGridSavedState();
    const savedState = this.getCurrentGridSavedStateReference();

    if (mode === GRID_MODE.FLAT) {
      this.gridModeGrid()?.applyFlatLayout();
    } else {
      this.handleSidebarColumnsVisibility(this.gridApi);
      this.toggleGroupCollapsing(false);
    }
    this.restoreGridState();

    setTimeout(() => {
      // Nothing saved for this mode yet -> give it a sensible first fit.
      if (!savedState.columnState.length) this.gridApi?.autoSizeAllColumns();
    });
  }

  private buildDrillDownToMenuItem(
    params: GetContextMenuItemsParams<CreditData>,
  ): MenuItemDef<CreditData> | null {
    if (!this.gridApi || !params.column) return null;
    if (typeof params.column.getColDef().showRowGroup !== 'string') return null;
    // Exclude footer/subtotal/grand-total rows
    if (params.node?.footer || params.node?.rowPinned) return null;

    const candidates = this.getPickableGroupColumns(params.column);
    if (candidates.length === 0) return null;

    const clickedId = params.column.getColId();
    const clickedNode = params.node ?? null;
    return {
      name: 'Drill-Down To',
      subMenu: candidates.map((col) => ({
        name: (col.getColDef().headerName as string) ?? String(col.getColId()),
        action: () => this.drillDownToColumn(col, params.column!, clickedId, clickedNode),
      })),
    };
  }

  private drillDownToColumn(
    picked: any,
    clickedColumn: any,
    clickedId: string,
    clickedNode: IRowNode | null,
  ) {
    if (!this.gridApi) return;
    // Menu click = user edit. The api calls below say 'api', so flag it ourselves.
    this.userHasInteracted = true;

    // clickedLevel comes from the *row-group hierarchy* (rowGroupIndex of the underlying
    // field column), NOT the displayed-column index. After several mixed Bring-to-Front /
    // Drill-Down operations the displayed index and the hierarchy level can drift apart.
    const clickedLevel = this.getRowGroupLevel(clickedColumn);
    if (clickedLevel < 0) return;

    // For drill-down we preserve expansions at AND above the clicked level — restoring the
    // clicked-level ones triggers onRowGroupOpened, which reveals the newly inserted
    // level-(N+1) placeholder that toggleGroupCollapsing(false) just hid. Plus: include the
    // clicked row itself so drilling on a collapsed grid still has a visible effect.
    const expansionsToRestore = new Set<string>();
    this.gridApi.forEachNode((node) => {
      if (node.group && node.expanded && node.level <= clickedLevel && node.id) {
        expansionsToRestore.add(node.id);
      }
    });
    if (clickedNode?.group && clickedNode.id) {
      expansionsToRestore.add(clickedNode.id);
    }

    // Unhide the pick then move it RIGHT AFTER the clicked placeholder in column STATE
    // order. onColumnMoved skips its clamp on API-sourced moves so the precise target
    // index isn't clobbered.
    this.gridApi.applyColumnState({
      state: [{ colId: picked.getColId(), hide: false }],
    });
    const clickedStateIdx = this.findStateIndex(clickedId);
    if (clickedStateIdx < 0) return;
    this.gridApi.moveColumns([picked], clickedStateIdx + 1);

    if (expansionsToRestore.size) {
      setTimeout(() => {
        expansionsToRestore.forEach((id) => {
          const node = this.gridApi?.getRowNode(id);
          if (node && !node.expanded) node.setExpanded(true);
        });
      });
    }
  }

  // Hierarchy level of a customRowGroup-{field} placeholder = the rowGroupIndex of its
  // underlying field column (which is what row nodes use for node.level).
  private getRowGroupLevel(placeholderColumn: any): number {
    const field = placeholderColumn?.getColDef()?.showRowGroup;
    if (typeof field !== 'string') return -1;
    const state = this.gridApi?.getColumnState() ?? [];
    const entry = state.find((s) => s.colId === field);
    if (!entry || entry.rowGroupIndex === null || entry.rowGroupIndex === undefined) return -1;
    return entry.rowGroupIndex;
  }

  // Position of a column in the CURRENT column state (vs. getColumns() which returns the
  // original definition order — meaningless after moves).
  private findStateIndex(colId: string): number {
    const state = this.gridApi?.getColumnState() ?? [];
    return state.findIndex((s) => s.colId === colId);
  }

  private buildBringToFrontMenuItem(
    params: GetContextMenuItemsParams<CreditData>,
  ): MenuItemDef<CreditData> | null {
    if (!this.gridApi || !params.column) return null;
    if (typeof params.column.getColDef().showRowGroup !== 'string') return null;
    // Exclude footer/subtotal/grand-total rows
    if (params.node?.footer || params.node?.rowPinned) return null;

    const candidates = this.getPickableGroupColumns(params.column);
    if (candidates.length === 0) return null;

    const clickedId = params.column.getColId();
    return {
      name: 'Bring to Front',
      subMenu: candidates.map((col) => ({
        name: (col.getColDef().headerName as string) ?? String(col.getColId()),
        action: () => this.bringColumnToFront(col, params.column!, clickedId),
      })),
    };
  }

  // Every row-group placeholder except the clicked one and the ones currently visible to
  // its left. Hidden/deeper placeholders stay in the list.
  private getPickableGroupColumns(clickedColumn: any): any[] {
    if (!this.gridApi) return [];

    const displayedGroupCols = this.gridApi
      .getAllDisplayedColumns()
      .filter((c) => typeof c.getColDef().showRowGroup === 'string');
    const clickedId = clickedColumn.getColId();
    const clickedDisplayIdx = displayedGroupCols.findIndex(
      (c) => c.getColId() === clickedId,
    );
    if (clickedDisplayIdx < 0) return [];

    const leftOfClicked = new Set(
      displayedGroupCols.slice(0, clickedDisplayIdx).map((c) => c.getColId()),
    );

    return (this.gridApi.getColumns() ?? []).filter((c) => {
      const def = c.getColDef();
      if (typeof def.showRowGroup !== 'string') return false;
      if (c.getColId() === clickedId) return false;
      if (leftOfClicked.has(c.getColId())) return false;
      return true;
    });
  }

  private bringColumnToFront(picked: any, clickedColumn: any, clickedId: string) {
    if (!this.gridApi) return;
    // Menu click = user edit. The api calls below say 'api', so flag it ourselves.
    this.userHasInteracted = true;

    // Use the row-group hierarchy level (rowGroupIndex of the underlying field), not the
    // displayed-column index. After a few mixed BTF/Drill operations these can diverge.
    const clickedLevel = this.getRowGroupLevel(clickedColumn);
    const expansionsToRestore: string[] = [];
    if (clickedLevel > 0) {
      this.gridApi.forEachNode((node) => {
        if (node.group && node.expanded && node.level < clickedLevel && node.id) {
          expansionsToRestore.push(node.id);
        }
      });
    }

    // Unhide the pick then move it into the clicked column's CURRENT STATE position.
    // moveColumns target is the state index (including hidden cols). onColumnMoved's
    // clamp now skips API-sourced moves so our precise target isn't clobbered.
    this.gridApi.applyColumnState({
      state: [{ colId: picked.getColId(), hide: false }],
    });
    const clickedStateIdx = this.findStateIndex(clickedId);
    if (clickedStateIdx >= 0) {
      this.gridApi.moveColumns([picked], clickedStateIdx);
    }

    if (expansionsToRestore.length) {
      setTimeout(() => {
        expansionsToRestore.forEach((id) => {
          const node = this.gridApi?.getRowNode(id);
          if (node && !node.expanded) {
            node.setExpanded(true);
          }
        });
      });
    }
  }

  private restoreGridState() {
    const currentGridState = this.getCurrentGridSavedStateReference();
    if (!currentGridState) return;

    // Cross-mode restore guard. Normally the two buckets never mix, but a
    // settings merge, an older client, or a hand-edited setting can put a pivot
    // layout in front of a flat grid - which renders a pivot behind a toggle
    // that says flat, and throws nothing to show for it. Rebuild the mode's
    // own default instead.
    if (!this.gridModeService.matches(currentGridState.mode)) {
      this.logTrace(
        '[RESET]',
        `saved layout is tagged '${currentGridState.mode ?? 'none'}', grid is in ${this.gridModeService.mode()} mode - discarding it`,
      );
      this.resetGridSavedState();
      if (this.gridModeService.isFlat()) this.gridModeGrid()?.applyFlatLayout();
      return;
    }

    setTimeout(() => {
      if (currentGridState.columnState.length) {
        this.gridApi?.applyColumnState({
          state: withoutAggFunc(currentGridState.columnState),
          applyOrder: true,
        });
      }
      if (currentGridState.rowGroupExpansion.length) {
        currentGridState.rowGroupExpansion.forEach((groupId: string) => {
          this.gridApi?.getRowNode(groupId)?.setExpanded(true);
        });
      }
    });
  }

  // Pivot and flat each keep their own saved layout, so a column state saved in
  // one mode is never restored into the other.
  private currentGridStateBucket(): CreditGridState[] {
    const settings = this.queryInputService.userSettings;
    return this.gridModeService.isFlat()
      ? (settings.flatGridState ??= [])
      : (settings.gridState ??= []);
  }

  private getCurrentGridSavedStateReference(): CreditGridState {
    return this.currentGridStateBucket()[0];
  }

  private shouldGridStateReset(): boolean {
    if (!this.currentGridStateBucket().length) {
      this.logTrace('[RESET]', 'initialize with empty gridState');
      this.resetGridSavedState();
      return false;
    }
    if (this.queryInputService.userSettings.queryOverrideEnabled) return false;

    const gridState = this.currentGridStateBucket()[0];
    const currentReportHash = this.getCurrentReportHash();

    if (!gridState.reportLastHash) {
      this.currentGridStateBucket()[0].reportLastHash = currentReportHash;

      if (!gridState.reportLastKeys)
        this.currentGridStateBucket()[0].reportLastKeys =
          this.creditPrestoQueryDataService.getQueryKeysFromPrestoQueryString();

      return false;
    }

    if (currentReportHash === gridState.reportLastHash) return false;

    const currentReportKeys =
      this.creditPrestoQueryDataService.getQueryKeysFromPrestoQueryString();

    if (!gridState.reportLastKeys) {
      this.currentGridStateBucket()[0].reportLastKeys = currentReportKeys;
      return false;
    }

    return !this.areQueryKeysEqual(currentReportKeys, gridState.reportLastKeys);
  }

  private areQueryKeysEqual(query1: QueryKeys, query2: QueryKeys): boolean {
    for (const [key, val] of Object.entries(query1)) {
      if (query2[key]?.length !== val.length) {
        this.logTrace('[RESET]', 'key change detected');
        return false;
      }
      if (query2[key].some((v2: any, index: number) => v2 !== val[index])) {
        this.logTrace('[RESET]', 'key change detected');
        return false;
      }
    }
    return true;
  }

  private logTrace(tag: string, msg: string) {
    const user = this.authenticationService.getUser();
    const msgLog = `${tag}, message: ${msg}, user: ${user?.uid},tileId ${this.configService.tileId}`;
    this.dynatraceService.logAction(msgLog);
    console.log(msgLog);
  }

  private getCurrentReportHash() {
    const reports = this.creditPrestoQueryDataService.currentData$.getValue();
    return reports?.[0].hash;
  }

  private freshGridState(mode: GridMode): CreditGridState {
    return {
      columnState: [],
      rowGroupExpansion: [],
      mode,
      reportLastHash: this.getCurrentReportHash(),
      reportLastKeys: this.creditPrestoQueryDataService.getQueryKeysFromPrestoQueryString(),
    };
  }

  // Wipes the saved layout of the mode on screen and restores the pristine
  // column defs. `everyMode` also wipes the other mode's: a change in the
  // report's shape invalidates both, and nothing else would reset the one that
  // isn't showing until the user next switched to it.
  private resetGridSavedState(everyMode = false) {
    const settings = this.queryInputService.userSettings;
    const flat = this.gridModeService.isFlat();
    if (flat || everyMode) settings.flatGridState = [this.freshGridState(GRID_MODE.FLAT)];
    if (!flat || everyMode) settings.gridState = [this.freshGridState(GRID_MODE.PIVOT)];
    this.gridApi?.setGridOption('columnDefs', this.creditGridDataService.gridColumns.getValue());
  }

  // Placeholder colIds of the columns that are actually row-grouped right now, in
  // column order. A placeholder is any column whose showRowGroup names a field;
  // in the flat grid most of them stand for ungrouped columns, so filtering by
  // the live row-group columns is what keeps those out.
  private getRowGroupColumnsOrder(): string[] {
    if (!this.gridApi) return [];
    const api = this.gridApi;
    const grouped = new Set(api.getRowGroupColumns().map((col) => col.getColId()));
    return api
      .getColumnState()
      .map((column) => column.colId)
      .filter((colId) => {
        const field = api.getColumn(colId)?.getColDef().showRowGroup;
        return typeof field === 'string' && grouped.has(field);
      });
  }

  private collapseAllChildrenRowGroups(childNodes: IRowNode[]) {
    childNodes.forEach((child) => {
      child.setExpanded(false, undefined, true);
      if (child.childrenAfterGroup) {
        this.collapseAllChildrenRowGroups(child.childrenAfterGroup);
      }
    });
  }

  private expandedRowGroupsForLevel(level: number): IRowNode[] {
    const expanded: IRowNode[] = [];
    this.gridApi?.forEachNode((node) => {
      if (!node.group || !node.expanded || node.level < level) {
        return;
      }
      expanded.push(node);
    });
    return expanded;
  }

  private setColumnVisibility(targetCol: any, visible = true) {
    this.gridApi?.setColumnsVisible([targetCol], visible);
    this.gridApi?.autoSizeColumns([targetCol]);
  }

  showMissingInGrid() {
    this.creditLayoutService.toggleMissingRiskTab();
  }

  toggleMissingProducts() {
    this.activePivotRiskId++;
    if (this.activePivotRiskId > this.totalPivotRiskFields - 1) this.activePivotRiskId = 0;
  }
}
