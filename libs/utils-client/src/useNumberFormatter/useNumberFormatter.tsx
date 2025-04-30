const defaultLocal = 'en-US';

interface FormatFileSizeOptions {
  unit?: 'bytes' | 'GB' | 'kB' | 'MB' | 'TB';
}

export function useNumberFormatter() {
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

  return { formatNumber, formatFileSize };
}
