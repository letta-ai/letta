import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ThumbsDownFilledIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M1.5 15.5V11.7155L4.977 3.5H16.173V15.5L9.5385 22.096L8.179 20.7365L9.3925 15.5H1.5ZM17.673 15.5V3.5H21.5V15.5H17.673Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
