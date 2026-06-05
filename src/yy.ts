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