import * as React from 'react';
import { Frame } from '../../framing/Frame/Frame';
import type { PropsWithChildren } from 'react';

type CardProps = PropsWithChildren<Record<never, string>>;

export function Card(props: CardProps) {
  const { children } = props;

  return (
    <Frame border fullWidth padding="xsmall" rounded>
      {children}
    </Frame>
  );
}
