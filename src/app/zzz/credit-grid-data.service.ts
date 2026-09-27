import { inject, Injectable } from '@angular/core';
import { ColDef, IRowNode, ValueFormatterParams } from 'ag-grid-community';
import { BehaviorSubject } from 'rxjs';
import { CreditData } from 'src/app/credit/models/credit-data.model';
import { CreditCsvToObjectsService } from 'src/app/credit/services/credit-csv-to-objects/credit-csv-to-objects.service';
import { CreditPrestoQueryDataService } from 'src/app/credit/services/credit-presto-query-data/credit-presto-query-data.service';
import {
  ColumnAggregation,
  DefaultColumnAggregation,
} from 'src/app/credit/interfaces/credit-column-aggregation.interface';
import { COLUMN_AGG_FUNCS } from 'src/app/credit/utils/credit-agg-funcs.utils';
import {
  HEADER_DATA_TYPE,
  ResponseHeaderDataType,
} from 'src/shared/interfaces/credit-response-header-data-type.interface';
import { ReportQuery } from 'src/shared/interfaces/query.interface';
import { AgGridToolsService } from 'src/shared/services/utility-services/ag-grid-tools.service';

@Injectable({
  providedIn: 'root',
})
export class CreditGridDataService {
  gridToolsService = inject(AgGridToolsService);
  csvToObjects = inject(CreditCsvToObjectsService);
  queryDataService = inject(CreditPrestoQueryDataService);

  gridColumns = new BehaviorSubject<ColDef<CreditData>[]>([]);
  sortFieldColumnSuffix = '_SortField';
  sortFieldColumnType = 'sortField';

  displayConfig = {
    hiddenKeys: ['uniqueKey', 'CorpPV01SOD', 'CorpPV01Intra', 'GovPV01SOD', 'GovPV01Intra'],
    dateDisplay: {
      valueFormatter: (params: ValueFormatterParams<CreditData>) => {
        if (params.data && params.data.maturityDate) {
          return this.gridToolsService.formatDateObjectForDisplay(
            params.data.maturityDate,
            false,
          );
        }
        return this.gridToolsService.formatDateObjectForDisplay(params.value, false);
      },
      comparator: this.gridToolsService.dateObjectComparator,
    },
    layoutOverrides: {
      maturityBucket: {
        // Buckets sort by the date behind them (1Y < 2Y < 10Y), never by label.
        // Group rows read the date off their first leaf; leaf rows (the flat
        // grid, where there are no groups at all) read their own.
        comparator: (
          _valueA: unknown,
          _valueB: unknown,
          nodeA: IRowNode<CreditData>,
          nodeB: IRowNode<CreditData>,
        ) => {
          const dateA = nodeA.allLeafChildren
            ? nodeA.allLeafChildren[0].data?.maturityDate
            : nodeA.data?.maturityDate;
          const dateB = nodeB.allLeafChildren
            ? nodeB.allLeafChildren[0].data?.maturityDate
            : nodeB.data?.maturityDate;
          if (!dateA || !dateB) {
            return 0;
          }
          return this.gridToolsService.dateObjectComparator(dateA, dateB);
        },
      },
    } as Record<string, any>,
    // Built per column so the leaf-row branch knows which `<field>_SortField` to
    // read - group rows get it from the row-group column, leaf rows (flat grid)
    // have no row-group column to ask.
    sortFieldColumn: (field: string) => ({
      comparator: (valueA: any, valueB: any, nodeA: any, nodeB: any, _isDescending: any) => {
        if (
          (nodeA.rowGroupColumn?.userProvidedColDef?.type as string[])?.includes(
            this.sortFieldColumnType,
          ) &&
          (nodeB.rowGroupColumn?.userProvidedColDef?.type as string[])?.includes(
            this.sortFieldColumnType,
          )
        ) {
          return (
            nodeA.allLeafChildren[0].data[nodeA.field + this.sortFieldColumnSuffix] -
            nodeB.allLeafChildren[0].data[nodeB.field + this.sortFieldColumnSuffix]
          );
        }
        const sortKey = field + this.sortFieldColumnSuffix;
        if (nodeA.data?.[sortKey] !== undefined && nodeB.data?.[sortKey] !== undefined) {
          return nodeA.data[sortKey] - nodeB.data[sortKey];
        }
        return valueA - valueB;
      },
    }),
  };

  updateColumns(headers: ResponseHeaderDataType<CreditData>, reportQuery: ReportQuery) {
    let allowedColumnHeaders = this.getAllowedColumnHeaders(headers, reportQuery);
    const columnExpressionMarkedAsKeys =
      this.queryDataService.getColumnExpressionKeysFromPrestoQueryString();
    const exemptKeywords = ['missing', 'error'];

    const columnDecimalPrecision =
      this.queryDataService.getColumnDecimalPrecisionFromPrestoQueryString();
    const columnAggregation = this.queryDataService.getColumnAggregationFromPrestoQueryString();
    // Exclude the _SortField columns from being processed and added to the grid
    const sortFieldColumnNames: string[] = allowedColumnHeaders
      .filter((col) => col[0].endsWith(this.sortFieldColumnSuffix))
      .map((col) => col[0].substring(0, col[0].indexOf(this.sortFieldColumnSuffix)));

    // Real columns
    allowedColumnHeaders = allowedColumnHeaders.filter(
      (col) =>
        !col[0].endsWith(this.sortFieldColumnSuffix) &&
        !exemptKeywords.some((x) => col[0].toLowerCase().includes(x)),
    );

    const columns: ColDef<CreditData>[] = allowedColumnHeaders.reduce<ColDef<CreditData>[]>(
      (acc, header) => {
        const [field, type] = header;
        const nextColumns: ColDef<CreditData>[] = [];
        const isFirst = acc.length === 0;
        const isSortable = sortFieldColumnNames.includes(field);

        if (type == HEADER_DATA_TYPE.Date || 'maturityDate' === field)
          nextColumns.push(
            ...this.getStringOrDateColumnTemplate(
              field as keyof CreditData,
              isFirst,
              true,
              isSortable,
            ),
          );
        else if (type == HEADER_DATA_TYPE.String)
          nextColumns.push(
            ...this.getStringOrDateColumnTemplate(
              field as keyof CreditData,
              isFirst,
              false,
              isSortable,
            ),
          );
        else if (type === HEADER_DATA_TYPE.Number)
          nextColumns.push(
            ...this.getNumberColumnTemplate(
              field as keyof CreditData,
              isSortable,
              columnExpressionMarkedAsKeys.some((mk: string) => mk === field),
              columnDecimalPrecision.find(
                (d: any) => d.key.toLowerCase() == field.toLowerCase(),
              )?.value || 0,
              columnAggregation.find((a) => a.key.toLowerCase() == field.toLowerCase())?.value,
            ),
          );

        return [...acc, ...nextColumns];
      },
      [] as ColDef<CreditData>[],
    );
    const processedColumns = this.preserveColumnExpressionOrder(columns, reportQuery);

    // If we're on the first set ever received just push the column definitions into the grids
    const oldColDefs = this.gridColumns.getValue();
    if (!oldColDefs.length) {
      this.gridColumns.next(processedColumns);
      return;
    }

    // For all other soft refreshes, check if we really need to update the col defs
    let shouldUpdate = false;
    for (const column of oldColDefs) {
      const result = processedColumns.findIndex(
        (x) => x.colId === column.colId || x.field === column.field,
      );
      if (result == -1) {
        shouldUpdate = true;
        break;
      }
      if (
        (column as ColDef<CreditData> & { decimal: number }).decimal !==
        (processedColumns.find((p) => p.field == column.field) as ColDef<CreditData> & {
          decimal: number;
        })?.decimal
      ) {
        shouldUpdate = true;
        break;
      }
    }
    if (shouldUpdate) {
      this.gridColumns.next(processedColumns);
    }
  }

  private getAllowedColumnHeaders(
    headers: ResponseHeaderDataType<CreditData>,
    reportQuery: ReportQuery,
  ) {
    const queries = reportQuery.params[0].queries;
    const exemptKeys: string[] = [
      ...this.displayConfig.hiddenKeys,
      ...this.csvToObjects.getExemptKeysFromQueryValues(queries),
    ];

    return headers.filter((h) => exemptKeys.every((k) => k !== h[0]));
  }

  private preserveColumnExpressionOrder(
    columns: ColDef<CreditData>[],
    reportQuery: ReportQuery,
  ) {
    const allColumnsExpressions = Object.keys(
      reportQuery.params[0].column_expressions ?? {},
    );
    const columnExpressionMarkedAsKeys =
      this.queryDataService.getColumnExpressionKeysFromPrestoQueryString();
    const columnsOrder = allColumnsExpressions.filter(
      (k) => !columnExpressionMarkedAsKeys.some((mk: string) => mk === k),
    );
    const orderSet = new Set(columnsOrder);
    const elementsToMove: ColDef<CreditData>[] = [];
    const remainingElements: ColDef<CreditData>[] = [];

    columns.forEach((item) => {
      if (item.field && orderSet.has(item.field)) {
        elementsToMove.push(item);
      } else {
        remainingElements.push(item);
      }
    });

    const reorderedData = [...remainingElements];

    columnsOrder.forEach((field) => {
      const element = elementsToMove.find((item) => item.field === field);
      if (element) {
        reorderedData.push(element);
      }
    });

    return reorderedData;
  }

  private getNumberColumnTemplate(
    field: keyof CreditData,
    isSortable = false,
    isKey = false,
    decimal = 0,
    aggregation: ColumnAggregation = DefaultColumnAggregation,
  ): ColDef<CreditData>[] {
    return [
      ...(isKey
        ? [
            {
              headerName: generateTitle(field as string),
              showRowGroup: field as string,
              colId: `customRowGroup-${field as string}`,
              type: ['customRowGroup'],
            },
          ]
        : []),
      {
        field,
        decimal,
        valueFormatter: (params: any) => this.formatTotalForDisplay(params, decimal),
        cellClass: (row: any) => this.getCellClassesForTotals(row.value),
        ...(!isKey && {
          enableCellChangeFlash: true,
          aggFunc: COLUMN_AGG_FUNCS[aggregation],
        }),
        type: [...(isSortable ? [this.sortFieldColumnType] : [])],
        ...(isSortable && this.displayConfig.sortFieldColumn(field as string)),
      } as ColDef<CreditData>,
    ];
  }

  private getStringOrDateColumnTemplate(
    field: keyof CreditData,
    isFirst: boolean,
    isDate = false,
    isSortable = false,
  ): ColDef<CreditData>[] {
    return [
      {
        headerName: generateTitle(field as string),
        showRowGroup: field as string,
        colId: `customRowGroup-${field as string}`,
        type: ['customRowGroup'],
        ...(isFirst && { hide: false }),
      },
      {
        field,
        // Named so ag-grid's Advanced Filter / Builder labels the (hidden) field
        // column with its pretty title, e.g. "Maturity Bucket" not "maturityBucket".
        headerName: generateTitle(field as string),
        type: ['customRowGroupField', ...(isSortable ? [this.sortFieldColumnType] : [])],
        ...(!isDate && field !== ('maturityBucket' as keyof CreditData) && { sort: 'asc' as const }),
        ...(isDate && this.displayConfig.dateDisplay),
        ...this.displayConfig.layoutOverrides[field as string],
        ...(isSortable && this.displayConfig.sortFieldColumn(field as string)),
      },
    ];
  }

  private formatTotalForDisplay(
    params: ValueFormatterParams<CreditData, any>,
    decPlaces: number,
  ): any {
    if (params.value === undefined || params.value === null) {
      return null;
    }
    if (params.value < 1 && params.value > -1) {
      return 0; // Special case when return 0 without ( )
    }
    if (params.value < 0) {
      return (
        '(' +
        this.gridToolsService.tidyNumber(params, true, decPlaces).replace('-', '') +
        ')'
      );
    }
    return this.gridToolsService.tidyNumber(params, true, decPlaces);
  }

  private getCellClassesForTotals(value: unknown): string {
    if (typeof value !== 'number') {
      return 'cell-class-total';
    }
    return value <= 0 ? 'cell-class-total negative' : 'cell-class-total';
  }
}

function generateTitle(camelCase: string): string {
  const spacedLabel = camelCase.replace(/([A-Z])/g, ' $1').trim();
  return spacedLabel.charAt(0).toUpperCase() + spacedLabel.slice(1);
}
