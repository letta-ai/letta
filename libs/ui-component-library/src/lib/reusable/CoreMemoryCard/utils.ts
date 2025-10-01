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

export function getChangedLine(
  oldValue?: string,
  newValue?: string,
): { oldLine: string | null; newLine: string | null } {
  // If both are empty or undefined, no change
  if ((!oldValue || oldValue === '') && (!newValue || newValue === '')) {
    return { oldLine: null, newLine: null };
  }

  // If old is empty, return the first line of new value
  if (!oldValue || oldValue === '') {
    const firstLine = newValue?.split('\n')[0] || null;
    return { oldLine: null, newLine: firstLine };
  }

  // If new is empty, return the first line of old value
  if (!newValue || newValue === '') {
    const firstLine = oldValue.split('\n')[0] || null;
    return { oldLine: firstLine, newLine: null };
  }

  const oldLines = oldValue.split('\n');
  const newLines = newValue.split('\n');

  // Find the first line that differs
  for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';

    if (oldLine !== newLine) {
      return {
        oldLine: oldLine || null,
        newLine: newLine || null,
      };
    }
  }

  // If all lines are the same, return nulls
  return { oldLine: null, newLine: null };
}
