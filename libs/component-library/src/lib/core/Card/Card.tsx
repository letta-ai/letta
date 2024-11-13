import * as React from 'react';
import { Frame } from '../../framing/Frame/Frame';
import type { PropsWithChildren } from 'react';
import { forwardRef } from 'react';

type CardProps = PropsWithChildren<{
  className?: string;
  onClick?: VoidFunction;
  testId?: string;
}>;

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  props,
  ref
) {
  const { children, onClick, className } = props;

  return (
    <Frame
      ref={ref}
      data-testid={props.testId}
      as={onClick ? 'button' : 'div'}
      onClick={onClick}
      className={className}
      border
      fullWidth
      padding="medium"
    >
      {children}
    </Frame>
  );
});
