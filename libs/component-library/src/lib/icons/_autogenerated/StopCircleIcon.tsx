import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function StopCircleIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15ZM6.5 5.5C5.94772 5.5 5.5 5.94772 5.5 6.5V9.5C5.5 10.0523 5.94772 10.5 6.5 10.5H9.5C10.0523 10.5 10.5 10.0523 10.5 9.5V6.5C10.5 5.94772 10.0523 5.5 9.5 5.5H6.5Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
