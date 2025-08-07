import * as React from 'react';

interface MiddleTruncateProps {
  children: string;
  visibleStart: number;
  visibleEnd: number;
}

export function MiddleTruncate(props: MiddleTruncateProps) {
  const { children, visibleStart, visibleEnd } = props;
  const textLength = children.length;
  const start = children.slice(0, visibleStart);
  const end = children.slice(textLength - visibleEnd, textLength);

  return (
    <span aria-hidden="true" className="relative overflow-hidden">
      <span className="overflow-hidden bg-transparent top-0 left-0 absolute select-all text-transparent w-full z-1">
        {children}
      </span>
      <span className="touch-none pointer-events-none select-none z-[-1] ">
        {start}
        ...
        {end}
      </span>
    </span>
  );
}
