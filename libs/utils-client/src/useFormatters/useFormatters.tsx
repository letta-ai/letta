import { useCallback } from 'react';

const defaultLocal = 'en-US';

interface FormatFileSizeOptions {
  unit?: 'bytes' | 'GB' | 'kB' | 'MB' | 'TB';
  maximumFractionDigits?: number;
}

export function useFormatters() {
  // Number Formatters

  function dynamicFileSize(value: number) {
    if (value >= 1_099_511_627_776) {
      return `${formatFileSize(value, { unit: 'TB' })} TB`;
    } else if (value >= 1_073_741_824) {
      return `${formatFileSize(value, { unit: 'GB' })} GB`;
    } else if (value >= 1_048_576) {
      return `${formatFileSize(value, { unit: 'MB' })} MB`;
    } else if (value >= 1024) {
      return `${formatFileSize(value, { unit: 'kB' })} kB`;
    }
    return `${formatFileSize(value, { unit: 'bytes' })} bytes`;
  }

  function formatFileSize(
    value: number,
    options: FormatFileSizeOptions = { unit: 'bytes' },
  ): string {
    const { unit, ...rest } = options;
    switch (options.unit) {
      case 'GB':
        return formatNumber(value / 1.25e8, {
          style: 'decimal',
          maximumFractionDigits: 2,
          ...rest,
        });
      case 'kB':
        return formatNumber(value / 1000, {
          style: 'decimal',
          maximumFractionDigits: 2,
          ...rest,
        });
      case 'MB':
        return formatNumber(value / 1e6, {
          style: 'decimal',
          maximumFractionDigits: 2,
          ...rest,
        });
      case 'TB':
        return formatNumber(value / 1e12, {
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

  function formatPercentage(value: number, options?: Intl.NumberFormatOptions) {
    return new Intl.NumberFormat(defaultLocal, {
      style: 'percent',
      maximumFractionDigits: 2,
      ...options,
    }).format(value);
  }

  const formatNumber = useCallback((number: number, options?: Intl.NumberFormatOptions) => {
    return new Intl.NumberFormat(
      defaultLocal,
      options || {
        style: 'decimal',
      },
    ).format(number);
  }, []);

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
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
        ...options,
      }).format(duration / 1_000_000);
    }

    // if less than 1 minute, format in seconds
    if (duration < 60_000_000_000) {
      return new Intl.NumberFormat(defaultLocal, {
        style: 'unit',
        unit: 'second',
        unitDisplay: 'narrow',
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
        ...options,
      }).format(duration / 1_000_000_000);
    }

    // if less than 1 hour, format in minutes
    if (duration < 3_600_000_000_000) {
      return new Intl.NumberFormat(defaultLocal, {
        style: 'unit',
        unit: 'minute',
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
        unitDisplay: 'narrow',
        ...options,
      }).format(duration / 60_000_000_000);
    }

    return new Intl.NumberFormat(defaultLocal, {
      style: 'unit',
      unit: 'hour',
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
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

  // Relative/friendly date formatting
  function formatRelative(date: Date | string): string {
    try {
      const d = new Date(date);
      const now = new Date();
      const diffMs = d.getTime() - now.getTime();
      const rtf = new Intl.RelativeTimeFormat(defaultLocal, { numeric: 'auto' });

      const seconds = Math.round(diffMs / 1000);
      const minutes = Math.round(seconds / 60);
      const hours = Math.round(minutes / 60);
      const days = Math.round(hours / 24);
      const weeks = Math.round(days / 7);
      const months = Math.round(days / 30);
      const years = Math.round(days / 365);

      if (Math.abs(seconds) < 60) return rtf.format(seconds, 'second');
      if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
      if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
      // Use weeks beyond 14 days instead of large day counts
      if (Math.abs(days) < 14) return rtf.format(days, 'day');
      if (Math.abs(days) < 30) return rtf.format(weeks, 'week');
      if (Math.abs(months) < 18) return rtf.format(months, 'month');
      return rtf.format(years, 'year');
    } catch (e) {
      console.error('Error formatting relative date:', e);
      return '';
    }
  }

  // Friendly relative date: relative for recent, else short date (no year if same year)
  function formatRelativeDate(date: Date | string): string {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.abs((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 45) {
      // show relative for anything within ~1.5 months
      return formatRelative(date);
    }

    const sameYear = d.getFullYear() === now.getFullYear();
    return new Intl.DateTimeFormat(defaultLocal, {
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' }),
    }).format(d);
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

  const formatTokenSize = useCallback(
    (val: number) => {
      if (val >= 1_000) {
        if (val >= 1_000_000) {
          // For millions, show up to 2 decimal places
          const millions = val / 1_000_000;
          if (millions % 1 === 0) {
            return `${millions.toFixed(0)}M`;
          } else {
            return `${millions.toFixed(2)}M`;
          }
        } else {
          // For thousands, show up to 2 decimal places
          const thousands = val / 1_000;
          if (thousands % 1 === 0) {
            return `${thousands.toFixed(0)}k`;
          } else {
            return `${thousands.toFixed(2)}k`;
          }
        }
      }
      return formatNumber(val);
    },
    [formatNumber],
  );

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
    dynamicFileSize,
    formatPercentage,
    formatCurrency,
    formatTime,
    formatShorthandNumber,
    formatTokenSize,
    formatDateAndTime,
    formatDate,
    formatRelative,
    formatRelativeDate,
  };
}
