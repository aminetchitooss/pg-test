formatNumber = ({ value }: ValueFormatterParams): string => {
      if (value == null || value === '') return '';
      const numeric = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(numeric) ? this.numberFormatter.format(numeric) : '';
    };