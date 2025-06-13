import * as React from 'react';
import type { FrameProps } from '../../framing/Frame/Frame';
import { Frame } from '../../framing/Frame/Frame';
import type { PropsWithChildren } from 'react';
import { forwardRef } from 'react';

type CardProps = PropsWithChildren<{
  className?: string;
  onClick?: VoidFunction;
  href?: string;
  testId?: string;
  color?: FrameProps['color'];
}>;

export const Card = forwardRef<HTMLElement, CardProps>(
  function Card(props, ref) {
    const { children, color, onClick, className } = props;

    return (
      <Frame
        ref={ref}
        data-testid={props.testId}
        {...(onClick ? { type: 'button', as: 'button' } : {})}
        {...(props.href ? { as: 'a', href: props.href } : {})}
        onClick={onClick}
        className={className}
        border
        fullWidth
        padding="medium"
        color={color}
      >
        {children}
      </Frame>
    );
  },
);
