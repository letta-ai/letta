'use client';
import { useCallback, useMemo, useState } from 'react';

function getStartOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getEndOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function useMonthCursor() {
  const [cursor, setCursor] = useState<Date>(new Date());

  const moveToNextMonth = useCallback(() => {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1));
  }, []);

  const moveToPrevMonth = useCallback(() => {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1));
  }, []);

  const startOfMonth = useMemo(() => getStartOfMonth(cursor), [cursor]);
  const endOfMonth = useMemo(() => getEndOfMonth(cursor), [cursor]);

  return {
    cursor,
    moveToNextMonth,
    moveToPrevMonth,
    startOfMonth,
    endOfMonth,
  };
}
