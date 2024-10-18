import * as React from 'react';
import './NiceGridDisplay.scss';
import { cn } from '@letta-web/core-style-config';

interface NiceGridDisplayProps {
  children: React.ReactNode;
}

export function NiceGridDisplay(props: NiceGridDisplayProps) {
  const { children } = props;

  return <div className={cn('nice-grid-display')}>{children}</div>;
}
