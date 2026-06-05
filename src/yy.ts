
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

  console.log('[PROFILE]', (() => { const r = data?.result?.result ?? []; const h = r[0]?.header ?? []; const rows = r.slice(1); const dateRe = /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$/; const stats = h.map((c: any, i: number) => { const vals =
  rows.map((row: any) => row[0][i]); let empties = 0, maxLen = 0, sample: any; for (const v of vals) { if (v === '' || v === null || v === undefined) empties++; else { if (sample === undefined) sample = v; const l = ('' + v).length; if (l >
  maxLen) maxLen = l; } } const distinct = new Set(vals).size; return { i, col: c[0], type: c[1], distinct, 'distinct%': +(100 * distinct / Math.max(vals.length, 1)).toFixed(1), empties, maxLen, dateLike: dateRe.test('' + sample), sample: '' +
  sample }; }); console.table(stats.map(({ i, ...rest }: any) => rest)); const dateCols = stats.filter((s: any) => s.dateLike); const union = new Set<any>(); let cells = 0; for (const s of dateCols) for (const row of rows) {
  union.add(row[0][s.i]); cells++; } const pct = 100 * union.size / Math.max(cells, 1); return `${rows.length} rows x ${h.length} cols | date cols: [${dateCols.map((s: any) => s.col).join(', ') || 'none'}] | ${cells} date cells, ${union.size}
  distinct = ${pct.toFixed(1)}% distinct -> memo ${pct < 80 ? 'HELPS (~' + (100 / Math.max(100 - pct, 1)).toFixed(1) + 'x ceiling)' : 'NO HELP'}`; })());