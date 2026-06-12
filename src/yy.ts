

  // The number/text/boolean cases reuse the base parsers, so the tricky logic
  // lives in one place. Everything else falls through to the base.
  private applyValue(newObject: any, propertyName: string, value: any, kind: ColumnKind): void {
    switch (kind) {
      case ColumnKind.Number:
        DataToObjectsService.parseNumberInto(newObject, propertyName, value);
        return;

      case ColumnKind.String:
        DataToObjectsService.parseStringInto(newObject, propertyName, value);
        return;

      case ColumnKind.Boolean:
        DataToObjectsService.parseBooleanInto(newObject, propertyName, value);
        return;

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


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


  protected parseValueIntoObjectPropertyType(
    newObject: any,
    sourcePropertyName: string,
    value: any,
  ) {
    // If the model defines a setter just let the setter handle the parsing
    if (DataToObjectsService.propertyHasSetter(newObject, sourcePropertyName)) {
      newObject[sourcePropertyName] = value;
      return;
    }

    // Parse numbers
    if (
      sourcePropertyName == 'uniqueKey' ||
      typeof newObject[sourcePropertyName] === 'number' ||
      newObject[sourcePropertyName] instanceof UndefinedNumber
    ) {
      DataToObjectsService.parseNumberInto(newObject, sourcePropertyName, value);
      return;
    }

    // Generic strings
    if (typeof newObject[sourcePropertyName] === 'string') {
      DataToObjectsService.parseStringInto(newObject, sourcePropertyName, value);
      return;
    }

    // Date objects
    if (
      newObject[sourcePropertyName] instanceof Date ||
      newObject[sourcePropertyName] instanceof UndefinedDate
    ) {
      newObject[sourcePropertyName] = DataToObjectsService.dateParser(value);
      return;
    }

    // Booleans
    if (typeof newObject[sourcePropertyName] === 'boolean') {
      DataToObjectsService.parseBooleanInto(newObject, sourcePropertyName, value);
      return;
    }

    // Parse inner-objects that implement the generic model
    if (newObject[sourcePropertyName] instanceof DataModel) {
      const inner: any = newObject[sourcePropertyName];
      const allowUnknownProperties = inner instanceof DataModelAllowUnknownProps;
      for (const [innerPropertyName, innerPropertyValue] of Object.entries(value)) {
        const sourceSubPropertyName =
          innerPropertyName.charAt(0).toLowerCase() + innerPropertyName.substring(1);
        // Skip unknown properties for safety - all properties should be defined in the model
        if (inner[sourceSubPropertyName] === undefined) {
          if (!allowUnknownProperties) {
            continue;
          }
          inner[sourceSubPropertyName] = ''; // Declare it as a string type
        }
        this.parseValueIntoObjectPropertyType(inner, sourceSubPropertyName, innerPropertyValue);
      }
      return;
    }

    // Fallback, unknown data format
    newObject[sourcePropertyName] = value;
  }


protected static isParseablePrimitive(value: any): boolean {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint';
  }

  protected static parseNumberInto(target: any, prop: string, value: any): void {
    if (!DataToObjectsService.isParseablePrimitive(value)) {
      console.warn("Unable to parse value into model property '" + prop + "':number'.");
      return;
    }
    target[prop] = Number(value);
    if (isNaN(target[prop])) {
      target[prop] = value; // Fallback for stuff that can't be parsed as a number
    }
  }

  protected static parseStringInto(target: any, prop: string, value: any): void {
    if (!DataToObjectsService.isParseablePrimitive(value)) {
      console.warn("Unable to parse value into model property '" + prop + "':string'.");
      return;
    }
    target[prop] = value.toString();
  }

  protected static parseBooleanInto(target: any, prop: string, value: any): void {
    if (!DataToObjectsService.isParseablePrimitive(value)) {
      console.warn("Unable to parse value into model property '" + prop + "':boolean'.");
      return;
    }
    const trimmedValue = value.toString().trim().toLowerCase();
    target[prop] = trimmedValue === 'true' || trimmedValue === '1';
  }