import React from 'react';
import './SpinnerPrimitive.scss';

interface SpinnerPrimitiveProps {
  className?: string;
}

export function SpinnerPrimitive({ className, ...props }: SpinnerPrimitiveProps) {
  return (
    <div
      className={`spinner ${className || ''}`}
      {...props}
    />
  );
}
