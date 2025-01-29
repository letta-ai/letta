const defaultLocal = 'en-US';

export function useCurrencyFormatter() {
  function formatCurrency(amount: number, options?: Intl.NumberFormatOptions) {
    return new Intl.NumberFormat(
      defaultLocal,
      options || {
        style: 'currency',
        maximumFractionDigits: 3,
        minimumFractionDigits: 3,
        currency: 'USD',
      },
    ).format(amount);
  }

  return { formatCurrency };
}
