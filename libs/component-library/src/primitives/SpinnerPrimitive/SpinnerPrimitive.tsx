import React from 'react';
import './SpinnerPrimitive.scss';

interface SpinnerPrimitiveProps {
  className?: string;
}

export function SpinnerPrimitive(props: SpinnerPrimitiveProps) {
  return <div className={`spinner ${props.className}`}></div>;
}
