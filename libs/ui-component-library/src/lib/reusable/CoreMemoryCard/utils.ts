// Utility functions for character and line counting
export function getCharCount(value?: string): number {
  return value?.length || 0;
}

export function getLineCount(value?: string | null | undefined): number {
  if (!value) return 0;
  return value.split('\n').length;
}

export function getLineDiff(
  oldValue?: string | null | undefined,
  newValue?: string | null | undefined,
): { minusLines: number; plusLines: number } {
  // Special case: going to empty (newValue is empty string)
  if (!newValue || newValue === '') {
    const oldLineCount = getLineCount(oldValue);
    return { minusLines: oldLineCount, plusLines: 0 };
  }

  // Special case: coming from empty (oldValue is empty/undefined)
  if (!oldValue || oldValue === '') {
    const newLineCount = getLineCount(newValue);
    return { minusLines: 0, plusLines: newLineCount };
  }

  // Split both values into lines
  const oldLines = oldValue.split('\n');
  const newLines = newValue.split('\n');

  let minusLines = 0;
  let plusLines = 0;

  // Iterate through all lines and count changes
  const maxLength = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLength; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    // Line was removed (exists in old but not in new)
    if (oldLine !== undefined && newLine === undefined) {
      minusLines++;
    }
    // Line was added (exists in new but not in old)
    else if (oldLine === undefined && newLine !== undefined) {
      plusLines++;
    }
    // Line was modified (exists in both but different)
    else if (oldLine !== newLine) {
      minusLines++;
      plusLines++;
    }
    // Line is unchanged (oldLine === newLine), no counting needed
  }

  return { minusLines, plusLines };
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
