//credit-date-parser.ts
import { DataToObjectsService } from 'src/shared/services/data-to-objects/data-to-objects.service';

// Memoized date parsing for the credit module. Maturity dates repeat across
// thousands of rows and dayjs strict parsing dominates the conversion, so we
// cache string -> Date. Lives in the credit module; the shared base is untouched.
export class CreditDateParser {
  private static readonly SOURCE_FORMATS = ['YYYY-MM-DD', 'DD/MM/YYYY'];

  private static readonly cache = new Map<string, Date | undefined>();

  // The memo only pays while the hit rate is high; real credit data has a few
  // hundred distinct dates. The cap guards against a pathological near-unique
  // dataset growing the cache unbounded — once full we just parse.
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
}
 




-----------------------------------------

//export class CreditData 
set maturityDate(value: any) {
    this._maturityDate = CreditDateParser.parse(value);
}
-----------------------------------------


//CreditCsvToObjectsService


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
    const probe = factory.create();
    const columnKinds: ColumnKind[] = new Array(objectKeysTypeMap.length);
    for (let i = 0; i < objectKeysTypeMap.length; i++) {
      columnKinds[i] = this.resolveColumnKind(probe, propertyNames[i], objectKeysTypeMap[i][1]);
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

  // The how to parse a column, in priority order:
  //   1. Has a setter -> Generic. The setter wins over everything else, so adding
  //      one to the model is the override knob for full control (e.g. maturityDate).
  //   2. Declared model field -> use its default value (0 = number, '' = text...).
  //   3. Dynamic column (Special for credit module)
  private resolveColumnKind(probe: any, propertyName: string, serverType: number): ColumnKind {
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
    // Not declared on the model: fall back to what the server says it is.
    switch (serverType) {
      case SERVER_TYPE_NUMBER:
        return ColumnKind.Number;
      case SERVER_TYPE_DATE:
        return ColumnKind.Date;
      case SERVER_TYPE_STRING:
        return ColumnKind.String;
      default:
        return ColumnKind.Generic;
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
