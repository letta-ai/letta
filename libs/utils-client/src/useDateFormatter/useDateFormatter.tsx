const defaultLocal = 'en-US';

export function useDateFormatter() {
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

  return { formatDateAndTime, formatDate };
}
