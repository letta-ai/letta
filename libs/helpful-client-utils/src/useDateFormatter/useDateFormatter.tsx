const defaultLocal = 'en-US';

export function useDateFormatter() {
  function formatDateAndTime(
    date: Date | string,
    options?: Intl.DateTimeFormatOptions
  ) {
    return new Intl.DateTimeFormat(
      defaultLocal,
      options || {
        dateStyle: 'medium',
        timeStyle: 'short',
      }
    ).format(new Date(date));
  }

  function formatDate(
    date: Date | string,
    options?: Intl.DateTimeFormatOptions
  ) {
    return new Intl.DateTimeFormat(
      defaultLocal,
      options || {
        dateStyle: 'medium',
      }
    ).format(new Date(date));
  }

  return { formatDateAndTime, formatDate };
}
