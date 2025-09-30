// Utility functions for character and line counting
export function getCharCount(value?: string): number {
  return value?.length || 0;
}

export function getLineCount(value?: string): number {
  if (!value) return 0;
  return value.split('\n').length;
}

export function getLineDiff(
  oldValue?: string,
  newValue?: string,
): { minusLines: number; plusLines: number } {
  const oldLineCount = getLineCount(oldValue);
  const newLineCount = getLineCount(newValue);

  // Special case: going to empty (newValue is empty string)
  if (newValue === '') {
    return { minusLines: oldLineCount, plusLines: 0 };
  }

  // Special case: coming from empty (oldValue is empty/undefined)
  if (!oldValue || oldValue === '') {
    return { minusLines: 0, plusLines: newLineCount };
  }

  const diff = newLineCount - oldLineCount;

  if (diff > 0) {
    return { minusLines: 0, plusLines: diff };
  } else if (diff < 0) {
    return { minusLines: Math.abs(diff), plusLines: 0 };
  }

  return { minusLines: 1, plusLines: 1 };
}
