import * as React from 'react';
import './NiceGridDisplay.scss';
import { cn } from '@letta-web/core-style-config';

interface NiceGridDisplayProps {
  children: React.ReactNode;
  itemWidth?: string;
  itemHeight?: string;
}

export function NiceGridDisplay(props: NiceGridDisplayProps) {
  const { children, itemWidth, itemHeight } = props;

  return (
    <div
      style={{
        ...(itemWidth
          ? {
              gridTemplateColumns: `repeat(auto-fill, minmax(${itemWidth}, 1fr))`,
            }
          : {}),
        ...(itemHeight
          ? {
              gridTemplateRows: `repeat(auto-fill, minmax(${itemHeight}, 1fr))`,
            }
          : {}),
      }}
      className={cn('nice-grid-display w-full')}
    >
      {children}
    </div>
  );
}
