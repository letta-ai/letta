import * as React from 'react';
import './CrossedOut.scss';

interface CrossedOutProps {
  children: React.ReactNode;
  ref?: React.RefObject<HTMLModElement>;
}

export function CrossedOut({ children, ...rest }: CrossedOutProps) {
  return (
    <del className="crossed-out" {...rest}>
      {children}
    </del>
  );
}
