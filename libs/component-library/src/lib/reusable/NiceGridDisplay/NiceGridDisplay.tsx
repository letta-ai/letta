import * as React from 'react';
import './NiceGridDisplay.scss';

interface NiceGridDisplayProps {
  children: React.ReactNode;
}

export function NiceGridDisplay(props: NiceGridDisplayProps) {
  const { children } = props;

  return <div className="nice-grid-display">{children}</div>;
}
