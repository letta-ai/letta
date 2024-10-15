import * as React from 'react';
import { Frame } from '../../framing/Frame/Frame';
import type { PropsWithChildren } from 'react';

type CardProps = PropsWithChildren<{
  className?: string;
  onClick?: () => void;
}>;

export function Card(props: CardProps) {
  const { children, onClick, className } = props;

  return (
    <Frame
      as={onClick ? 'button' : 'div'}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          e.preventDefault();
          onClick();
        }
      }}
      className={className}
      border
      fullWidth
      padding="medium"
    >
      {children}
    </Frame>
  );
}
