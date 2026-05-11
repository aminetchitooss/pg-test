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

  private buildBringToFrontMenuItem(
    params: GetContextMenuItemsParams<CreditData>,
  ): MenuItemDef<CreditData> | null {
    if (!this.gridApi || !params.column) return null;

    const allColumns = this.gridApi.getColumns() ?? [];
    // Drop the underlying row-group field columns — they're hidden duplicates of their
    // customRowGroup-* placeholders, which already represent them in the menu.
    const ordered = allColumns.filter((col) => {
      const def = col.getColDef();
      const types = Array.isArray(def.type) ? def.type : def.type ? [def.type] : [];
      return !types.includes('customRowGroupField');
    });

    const clickedId = params.column.getColId();
    const clickedIdx = ordered.findIndex((c) => c.getColId() === clickedId);
    if (clickedIdx < 0) return null;

    const candidates = ordered.slice(clickedIdx + 1);
    if (candidates.length === 0) return null;

    return {
      name: 'Bring to Front',
      subMenu: candidates.map((col) => ({
        name: (col.getColDef().headerName as string) ?? String(col.getColId()),
        action: () => {
          // Unhide hidden picks (e.g. customRowGroup placeholders whose parent isn't expanded)
          // then move into the clicked column's current displayed position.
          this.gridApi?.applyColumnState({
            state: [{ colId: col.getColId(), hide: false }],
          });
          const displayed = this.gridApi?.getAllDisplayedColumns() ?? [];
          const targetIdx = displayed.findIndex((c) => c.getColId() === clickedId);
          if (targetIdx >= 0) {
            this.gridApi?.moveColumns([col], targetIdx);
          }
        },
      })),
    };
  }