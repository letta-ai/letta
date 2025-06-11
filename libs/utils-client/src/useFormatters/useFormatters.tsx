const defaultLocal = 'en-US';

interface FormatFileSizeOptions {
  unit?: 'bytes' | 'GB' | 'kB' | 'MB' | 'TB';
  maximumFractionDigits?: number;
}

export function useFormatters() {
  // Number Formatters

  function formatFileSize(
    value: number,
    options: FormatFileSizeOptions = { unit: 'bytes' },
  ): string {
    const { unit, ...rest } = options;
    switch (options.unit) {
      case 'GB':
        return formatNumber(value / 1_073_741_824, {
          style: 'decimal',
          maximumFractionDigits: 2,
          ...rest,
        });
      case 'kB':
        return formatNumber(value / 1024, {
          style: 'decimal',
          maximumFractionDigits: 2,
          ...rest,
        });
      case 'MB':
        return formatNumber(value / 1_048_576, {
          style: 'decimal',
          maximumFractionDigits: 2,
          ...rest,
        });
      case 'TB':
        return formatNumber(value / 1_099_511_627_776, {
          style: 'decimal',
          maximumFractionDigits: 2,
          ...rest,
        });
      default:
        return formatNumber(value, {
          style: 'decimal',
          maximumFractionDigits: 0,
          ...rest,
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

  function formatSmallDuration(
    duration: number, // in nanoseconds
    options?: Intl.NumberFormatOptions,
  ) {
    // if less than 1 millisecond, format in microseconds
    if (duration < 1_000_000) {
      return `${duration / 1000} μs`;
    }

    // if less than 1 second, format in milliseconds
    if (duration < 1_000_000_000) {
      return new Intl.NumberFormat(defaultLocal, {
        style: 'unit',
        unit: 'millisecond',
        unitDisplay: 'narrow',
        ...options,
      }).format(duration / 1_000_000);
    }

    // if less than 1 minute, format in seconds
    if (duration < 60_000_000_000) {
      return new Intl.NumberFormat(defaultLocal, {
        style: 'unit',
        unit: 'second',
        unitDisplay: 'narrow',
        ...options,
      }).format(duration / 1_000_000_000);
    }

    // if less than 1 hour, format in minutes
    if (duration < 3_600_000_000_000) {
      return new Intl.NumberFormat(defaultLocal, {
        style: 'unit',
        unit: 'minute',
        unitDisplay: 'narrow',
        ...options,
      }).format(duration / 60_000_000_000);
    }

    return new Intl.NumberFormat(defaultLocal, {
      style: 'unit',
      unit: 'hour',
      ...options,
    }).format(duration / 3_600_000_000_000);
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

  function formatShorthandNumber(val: number, decimals = 0) {
    if (val >= 1_000_000_000) {
      return `${(val / 1_000_000_000).toFixed(decimals)}B`;
    } else if (val >= 1_000_000) {
      return `${(val / 1_000_000).toFixed(decimals)}M`;
    } else if (val >= 1_000) {
      return `${(val / 1_000).toFixed(decimals)}K`;
    }
    return val.toString();
  }

  function formatTime(
    date: Date | string,
    options?: Intl.DateTimeFormatOptions,
  ) {
    try {
      return new Intl.DateTimeFormat(
        defaultLocal,
        options || {
          timeStyle: 'short',
        },
      ).format(new Date(date));
    } catch (e) {
      console.error('Error formatting time:', e);
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
    formatSmallDuration,
    formatFileSize,
    formatCurrency,
    formatTime,
    formatShorthandNumber,
    formatDateAndTime,
    formatDate,
  };
}
