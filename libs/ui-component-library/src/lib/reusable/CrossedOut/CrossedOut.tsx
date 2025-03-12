import * as React from 'react';
import './CrossedOut.scss';

interface CrossedOutProps {
  children: React.ReactNode;
}

export function CrossedOut(props: CrossedOutProps) {
  return <del className="crossed-out">{props.children}</del>;
}
