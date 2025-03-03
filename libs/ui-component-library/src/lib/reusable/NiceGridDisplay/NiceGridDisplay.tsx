import * as React from 'react';
import './NiceGridDisplay.scss';
import { cn } from '@letta-cloud/ui-styles';

interface NiceGridDisplayProps {
  children: React.ReactNode;
  itemWidth?: string;
  itemHeight?: string;
  fullHeight?: boolean;
}

export function NiceGridDisplay(props: NiceGridDisplayProps) {
  const { children, fullHeight, itemWidth, itemHeight } = props;

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
      className={cn('nice-grid-display w-full', fullHeight && 'h-full')}
    >
      {children}
    </div>
  );
}
