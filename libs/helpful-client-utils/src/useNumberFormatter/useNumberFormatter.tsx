const defaultLocal = 'en-US';

export function useNumberFormatter() {
  function formatNumber(number: number, options?: Intl.NumberFormatOptions) {
    return new Intl.NumberFormat(
      defaultLocal,
      options || {
        style: 'decimal',
      },
    ).format(number);
  }

  return { formatNumber };
}
