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
    const drillDown = this.buildDrillDownToMenuItem(params);
    const bringToFront = this.buildBringToFrontMenuItem(params);
    const customItems: (DefaultMenuItem | MenuItemDef<CreditData>)[] = [];
    if (drillDown) customItems.push(drillDown);
    if (bringToFront) customItems.push(bringToFront);
    if (customItems.length === 0) return defaults;
    return [...customItems, 'separator', ...defaults];
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