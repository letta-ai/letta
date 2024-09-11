import * as React from 'react';
import { Frame } from '../../framing/Frame/Frame';
import type { PropsWithChildren } from 'react';

type CardProps = PropsWithChildren<{
  className?: string;
}>;

export function Card(props: CardProps) {
  const { children, className } = props;

  return (
    <Frame className={className} border fullWidth padding="medium" rounded>
      {children}
    </Frame>
  );
}
