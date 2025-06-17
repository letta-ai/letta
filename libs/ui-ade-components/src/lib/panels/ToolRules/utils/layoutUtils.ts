export function getTextWidth(text: string, fontSize = 12): number {
  const charWidth = fontSize * 0.6;
  return Math.max(text.length * charWidth + 24, 100);
}

import { LAYOUT } from '../types';
export function getCenteredYPositions(count: number): number[] {
  const totalHeight = (count - 1) * LAYOUT.NODE_SPACING;
  const startY = LAYOUT.CONTROL_Y - totalHeight / 2;
  return Array.from(
    { length: count },
    (_, i) => startY + i * LAYOUT.NODE_SPACING,
  );
}
