import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ThumbsDownIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        width="21"
        height="20"
        viewBox="0 0 21 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0.5 12.5V8.7155L3.977 0.5H15.7885V12.5L9.15375 19.096L7.79425 17.7365L9.00775 12.5H0.5ZM14.2885 2H4.9905L2 9.0095V11H10.9038L9.65 16.4808L14.2885 11.8615V2ZM15.7885 12.5V11H19V2H15.7885V0.5H20.5V12.5H15.7885Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
