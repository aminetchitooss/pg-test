import { Injectable } from '@angular/core';
import { ReportQuery } from 'src/shared/interfaces/query.interface';
import { ReportResponse } from 'src/shared/interfaces/rpc-response.interface';
import {
  DataToObjectsService,
  UndefinedNumber,
} from 'src/shared/services/data-to-objects/data-to-objects.service';
import { GenericObjectFactory } from 'src/shared/services/data-to-objects/generic-object-factory';
import { CreditDateParser } from './credit-date-parser';

// A column holds the same type in every row. Instead of letting the base parser
// re-check the type on every cell, we work it out once per column and remember
// it. ColumnKind is that note; Generic means "let the base parser handle it".
enum ColumnKind {
  Number,
  String,
  Boolean,
  Date,
  Generic,
}

// Type codes the server sends for each column (second item of each header pair).
const SERVER_TYPE_STRING = 3;
const SERVER_TYPE_NUMBER = 4;
const SERVER_TYPE_DATE = 5;

// For undeclared columns the server type code is the only hint, and it can be
// wrong (e.g. a date column tagged as string). We sniff the real value shape to
// recover it, sampling the first non-empty cell within this many rows so a blank
// leading cell doesn't defeat the check. Bounded so setup stays O(cols).
const MAX_SAMPLE_ROWS = 20;

@Injectable({
  providedIn: 'root',
})
export class CreditCsvToObjectsService extends DataToObjectsService {
  convert<T extends object>(
    data: ReportResponse,
    factory: GenericObjectFactory<T>,
    reportQuery: ReportQuery,
  ): T[] {
    // Bound the date memo to one conversion so it can't grow across runs.
    CreditDateParser.clearCache();

    const dataResult: Array<any> = data?.result?.result;
    if (dataResult === undefined || dataResult.length === 0) {
      return [];
    }

    const queries = reportQuery.params[0].queries;
    const exemptSet = this.getExemptKeysFromQueryValues(queries);
    const hasExemptProperties = exemptSet.size > 0;

    // The first element of the response maps the properties by index
    // to a name and data type [ ['uniqueKey', 3] , ['currencyCode', 3] ]
    const objectKeysTypeMap = dataResult.shift().header;
    const propertyNames: string[] = new Array(objectKeysTypeMap.length);
    for (let i = 0; i < objectKeysTypeMap.length; i++) {
      propertyNames[i] = objectKeysTypeMap[i][0];
    }

    // Work out each column's kind once (using an empty sample object), not per cell.
    // A representative value per column lets us double-check the server type code
    // for undeclared columns; sampling here keeps it out of the per-cell loop.
    const probe = factory.create();
    const columnSamples = this.sampleColumns(dataResult, objectKeysTypeMap.length);
    const columnKinds: ColumnKind[] = new Array(objectKeysTypeMap.length);
    for (let i = 0; i < objectKeysTypeMap.length; i++) {
      columnKinds[i] = this.resolveColumnKind(
        probe,
        propertyNames[i],
        objectKeysTypeMap[i][1],
        columnSamples[i],
      );
    }

    const numRows = dataResult.length;
    const results: T[] = new Array(numRows);

    // Results are just an array of value for each object:
    // [ [ 1, EUR, "", "EUR OIS" ], [ 2, EUR, "", "EUR XCCY" ... ] ]
    // Map those by searching the index of each value in objectKeysTypeMap
    for (let i = 0; i < numRows; i++) {
      const cells = dataResult[i][0];
      const newObject: T = factory.create();

      for (let j = 0; j < cells.length; j++) {
        const propertyName = propertyNames[j];
        if (hasExemptProperties && exemptSet.has(propertyName)) {
          continue;
        }
        this.applyValue(newObject, propertyName, cells[j], columnKinds[j]);
      }

      results[i] = newObject;
    }

    return results;
  }

  getExemptKeysFromQueryValues(queries: { [key: string]: any[] }): Set<string> {
    const exemptKeys = new Set<string>(['govCorp']);

    for (const key of Object.keys(queries)) {
      const values = queries[key]?.[2];
      if (values === undefined) {
        continue;
      }
      for (let j = 0; j < values.length; j++) {
        exemptKeys.add(values[j].split('=')[0]);
      }
    }

    return exemptKeys;
  }

  // First non-empty value seen for each column, scanning at most MAX_SAMPLE_ROWS
  // rows. Row-outer with early exit: once every column has a sample we stop, so
  // the common case (a fully-populated first row) costs a single row scan.
  private sampleColumns(rows: any[], numCols: number): any[] {
    const samples: any[] = new Array(numCols);
    let filled = 0;
    const limit = Math.min(MAX_SAMPLE_ROWS, rows.length);
    for (let r = 0; r < limit && filled < numCols; r++) {
      const cells = rows[r][0];
      for (let c = 0; c < numCols; c++) {
        if (samples[c] === undefined) {
          const value = cells[c];
          if (value !== undefined && value !== null && value !== '') {
            samples[c] = value;
            filled++;
          }
        }
      }
    }
    return samples;
  }

  // The how to parse a column, in priority order:
  //   1. Has a setter -> Generic. The setter wins over everything else, so adding
  //      one to the model is the override knob for full control (e.g. maturityDate).
  //   2. Declared model field -> use its default value (0 = number, '' = text...).
  //   3. Dynamic column (Special for credit module)
  private resolveColumnKind(
    probe: any,
    propertyName: string,
    serverType: number,
    sample: unknown,
  ): ColumnKind {
    if (DataToObjectsService.propertyHasSetter(probe, propertyName)) {
      return ColumnKind.Generic;
    }
    const current = probe[propertyName];
    if (
      propertyName === 'uniqueKey' ||
      typeof current === 'number' ||
      current instanceof UndefinedNumber
    ) {
      return ColumnKind.Number;
    }
    if (typeof current === 'string') {
      return ColumnKind.String;
    }
    if (typeof current === 'boolean') {
      return ColumnKind.Boolean;
    }
    if (current instanceof Date) {
      return ColumnKind.Date;
    }
    // Not declared on the model: the server type code is the only hint, and it can
    // be wrong. Verify date-ness against the sampled value before trusting it, so a
    // date column mistyped as string/number (or an unknown code) is still recovered.
    switch (serverType) {
      case SERVER_TYPE_NUMBER:
        return CreditDateParser.looksLikeDate(sample) ? ColumnKind.Date : ColumnKind.Number;
      case SERVER_TYPE_DATE:
        // Already a date per the server; the parser returns undefined safely if not.
        return ColumnKind.Date;
      case SERVER_TYPE_STRING:
        return CreditDateParser.looksLikeDate(sample) ? ColumnKind.Date : ColumnKind.String;
      default:
        return CreditDateParser.looksLikeDate(sample) ? ColumnKind.Date : ColumnKind.Generic;
    }
  }

  // The number/text/boolean cases below are copied on purpose from the base 
  // Everything else falls through to the base, so the tricky parts are never copied.
  private applyValue(newObject: any, propertyName: string, value: any, kind: ColumnKind): void {
    switch (kind) {
      case ColumnKind.Number: {
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
          console.warn("Unable to parse value into model property '" + propertyName + "':number'.");
          return;
        }
        newObject[propertyName] = Number(value);
        if (isNaN(newObject[propertyName])) {
          newObject[propertyName] = value; // Fallback for stuff that can't be parsed as a number
        }
        return;
      }

      case ColumnKind.String: {
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
          console.warn("Unable to parse value into model property '" + propertyName + "':string'.");
          return;
        }
        newObject[propertyName] = value.toString();
        return;
      }

      case ColumnKind.Boolean: {
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
          console.warn("Unable to parse value into model property '" + propertyName + "':boolean'.");
          return;
        }
        const trimmedValue = value.toString().trim().toLowerCase();
        newObject[propertyName] = trimmedValue === 'true' || trimmedValue === '1';
        return;
      }

      case ColumnKind.Date:
        // Same memoized parser the maturityDate setter uses, so dynamic date
        // columns are parsed (and cached) the same way.
        newObject[propertyName] = CreditDateParser.parse(value);
        return;

      default:
        // Anything not copied above goes back to the base untouched. The date
        // memo also kicks in here: maturityDate's setter calls CreditDateParser.
        this.parseValueIntoObjectPropertyType(newObject, propertyName, value);
    }
  }
}




///////////////


import { DataToObjectsService } from 'src/shared/services/data-to-objects/data-to-objects.service';

// Parsing a date is slow and the same maturity dates repeat across thousands of
// rows, so we parse each one once and remember it. Lives in the credit module so
// the shared date parser stays untouched.
export class CreditDateParser {
  private static readonly SOURCE_FORMATS = ['YYYY-MM-DD', 'DD/MM/YYYY'];

  // Shape tests mirroring SOURCE_FORMATS. Used to verify undeclared columns
  // whose server type code may be wrong, before trusting it. A precompiled
  // regex test (~20ns) is far cheaper than actually invoking the date parser.
  private static readonly DATE_SHAPES = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
  ];

  private static readonly cache = new Map<string, Date | undefined>();

  // Safety net: most reports have only a few hundred distinct dates. If one had a
  // huge number, we stop caching past this point so memory can't grow forever.
  private static readonly MAX_CACHE_SIZE = 50_000;

  static parse(value: any): Date | undefined {
    if (typeof value !== 'string') {
      return DataToObjectsService.dateParser(value, false, CreditDateParser.SOURCE_FORMATS);
    }
    // has() so an unparseable value is cached as undefined, not re-parsed.
    if (CreditDateParser.cache.has(value)) {
      return CreditDateParser.cache.get(value);
    }
    const parsed = DataToObjectsService.dateParser(value, false, CreditDateParser.SOURCE_FORMATS);
    if (CreditDateParser.cache.size < CreditDateParser.MAX_CACHE_SIZE) {
      CreditDateParser.cache.set(value, parsed);
    }
    return parsed;
  }

  static clearCache(): void {
    CreditDateParser.cache.clear();
  }

  // Cheap shape check for undeclared columns: does this value look like one of
  // the source date formats? Used at setup time (once per column), never per cell.
  static looksLikeDate(value: unknown): boolean {
    if (value instanceof Date) {
      return true;
    }
    if (typeof value !== 'string') {
      return false;
    }
    const trimmed = value.trim();
    return (
      CreditDateParser.DATE_SHAPES[0].test(trimmed) || CreditDateParser.DATE_SHAPES[1].test(trimmed)
    );
  }
}
