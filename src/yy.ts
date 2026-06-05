
 // Credit reports repeat the same date strings across many rows (settlement,
  // maturity, trade dates). dayjs strict parsing dominates the conversion, so we
  // memoize it for the lifetime of a single convert() call. Scoped to this
  // subclass on purpose: the shared base must stay generic for other modules.
  private readonly dateCache = new Map<string, Date | undefined>();


    // Bound the cache to one conversion so the root singleton can't grow forever.
    this.dateCache.clear();



// Override only to memoize the date branch. We intercept the exact case the
  // base would route to dateParser() — a date-typed property, no setter, string
  // value — and delegate everything else unchanged to the shared implementation.
  protected override parseValueIntoObjectPropertyType(
    newObject: any,
    sourcePropertyName: string,
    value: any,
  ): void {
    const current = newObject[sourcePropertyName];
    const isDateProperty = current instanceof Date || current instanceof UndefinedDate;

    if (
      isDateProperty &&
      typeof value === 'string' &&
      !DataToObjectsService.propertyHasSetter(newObject, sourcePropertyName)
    ) {
      newObject[sourcePropertyName] = this.parseDateMemoized(value);
      return;
    }

    super.parseValueIntoObjectPropertyType(newObject, sourcePropertyName, value);
  }

  private parseDateMemoized(value: string): Date | undefined {
    // Map.has so we cache "invalid -> undefined" too, instead of re-parsing it.
    if (this.dateCache.has(value)) {
      return this.dateCache.get(value);
    }
    const parsed = DataToObjectsService.dateParser(value);
    this.dateCache.set(value, parsed);
    return parsed;
  }

  console.log('[maturityDate] ' + (() => { const r = data?.result?.result ?? []; const idx = (r[0]?.header ?? []).findIndex((c: any) => c[0] === 'maturityDate'); if (idx < 0) return 'column not found'; const vals = r.slice(1).map((row: any) =>
  row[0][idx]); const distinct = new Set(vals).size; return `${vals.length} rows, ${distinct} distinct, ${(100 * (1 - distinct / Math.max(vals.length, 1))).toFixed(1)}% repeats → ~${(vals.length / Math.max(distinct, 1)).toFixed(0)}x avg reuse`;
  })());