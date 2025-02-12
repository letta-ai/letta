const defaultLocal = 'en-US';

export function useCurrencyFormatter() {
  function formatCurrency(amount: number, options?: Intl.NumberFormatOptions) {
    return new Intl.NumberFormat(defaultLocal, {
      style: 'currency',
      maximumFractionDigits: 3,
      minimumFractionDigits: 3,
      currency: 'USD',
      ...options,
    }).format(amount);
  }

  return { formatCurrency };
}
