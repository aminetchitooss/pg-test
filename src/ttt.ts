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
  };


  private buildContextMenuItems(
    params: GetContextMenuItemsParams<CreditData>,
  ): (DefaultMenuItem | MenuItemDef<CreditData>)[] {
    const defaults = (params.defaultItems ?? []) as (DefaultMenuItem | MenuItemDef<CreditData>)[];
    const bringToFront = this.buildBringToFrontMenuItem(params);
    if (!bringToFront) return defaults;
    return [bringToFront, 'separator', ...defaults];
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

    const candidates = this.getCandidateGroupPlaceholders(params.column);
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

  // Candidates for the Bring-to-Front submenu are every row-group placeholder
  // EXCEPT the clicked column itself and the placeholders currently displayed to its LEFT.
  // Hidden placeholders deeper in the hierarchy ARE included, and so are placeholders that
  // were previously brought forward then pushed to a deeper position — anything not on the
  // left of the clicked column right now is a fair pick.
  private getCandidateGroupPlaceholders(clickedColumn: any): any[] {
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

    // Use the row-group hierarchy level (rowGroupIndex of the underlying field), not the
    // displayed-column index — node.level reads rgi, so they need to stay in sync.
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