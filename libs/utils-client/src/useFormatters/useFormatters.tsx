const defaultLocal = 'en-US';

interface FormatFileSizeOptions {
  unit?: 'bytes' | 'GB' | 'kB' | 'MB' | 'TB';
}

export function useFormatters() {
  // Number Formatters

  function formatFileSize(
    value: number,
    options: FormatFileSizeOptions = { unit: 'bytes' },
  ): string {
    switch (options.unit) {
      case 'GB':
        return formatNumber(value / 1_073_741_824, {
          style: 'decimal',
          maximumFractionDigits: 2,
        });
      case 'kB':
        return formatNumber(value / 1024, {
          style: 'decimal',
          maximumFractionDigits: 2,
        });
      case 'MB':
        return formatNumber(value / 1_048_576, {
          style: 'decimal',
          maximumFractionDigits: 2,
        });
      case 'TB':
        return formatNumber(value / 1_099_511_627_776, {
          style: 'decimal',
          maximumFractionDigits: 2,
        });
      default:
        return formatNumber(value, {
          style: 'decimal',
          maximumFractionDigits: 0,
        });
    }
  }

  function formatNumber(number: number, options?: Intl.NumberFormatOptions) {
    return new Intl.NumberFormat(
      defaultLocal,
      options || {
        style: 'decimal',
      },
    ).format(number);
  }

  // Currency Formatters

  function formatCurrency(amount: number, options?: Intl.NumberFormatOptions) {
    return new Intl.NumberFormat(defaultLocal, {
      style: 'currency',
      maximumFractionDigits: 3,
      minimumFractionDigits: 3,
      currency: 'USD',
      ...options,
    }).format(amount);
  }

  // Date Formatters

  function formatDateAndTime(
    date: Date | string,
    options?: Intl.DateTimeFormatOptions,
  ) {
    try {
      return new Intl.DateTimeFormat(
        defaultLocal,
        options || {
          dateStyle: 'medium',
          timeStyle: 'short',
        },
      ).format(new Date(date));
    } catch (e) {
      console.error('Error formatting date and time:', e);
      return '';
    }
  }

  function formatDate(
    date: Date | string,
    options?: Intl.DateTimeFormatOptions,
  ) {
    try {
      return new Intl.DateTimeFormat(
        defaultLocal,
        options || {
          dateStyle: 'medium',
        },
      ).format(new Date(date));
    } catch (e) {
      console.error('Error formatting date:', e);
      return '';
    }
  }

  return {
    formatNumber,
    formatFileSize,
    formatCurrency,
    formatDateAndTime,
    formatDate,
  };
}
