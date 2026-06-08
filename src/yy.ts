  convert<T extends object>(
    data: ReportResponse,
    factory: GenericObjectFactory<T>,
    reportQuery: ReportQuery,
  ): T[] {
    const t0 = performance.now(); // TEMP timing — remove before commit


    const tLoopStart = performance.now(); // TEMP timing — remove before commit




        // TEMP timing — remove before commit
    const tEnd = performance.now();
    console.log('%c[convert] HYBRID (kind hoist + memo)', 'font-weight:bold;color:#22c55e');
    console.table([
      { phase: 'setup (header + kinds)', ms: +(tLoopStart - t0).toFixed(2) },
      { phase: 'row loop', ms: +(tEnd - tLoopStart).toFixed(2) },
      { phase: 'TOTAL', ms: +(tEnd - t0).toFixed(2) },
    ]);
    console.log(
      `rows=${numRows}  cols=${objectKeysTypeMap.length}  distinctDatesCached=${CreditDateParser.cacheSize}`,
    );

    return results;
  }

  


// TEMP (timing diagnostic): how many distinct dates were cached this run.
  static get cacheSize(): number {
    return CreditDateParser.cache.size;
  }