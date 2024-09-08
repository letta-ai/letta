import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function BellIcon(props: IconWrappedProps) {
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
          d="M12 5C12 2.79086 10.2091 1 8 1C5.79086 1 4 2.79086 4 5V7.37868C4 7.7765 3.84197 8.15804 3.56066 8.43934L2.29289 9.70711C2.10536 9.89464 2 10.149 2 10.4142V11C2 11.5523 2.44772 12 3 12H5C5 13.6569 6.34315 15 8 15C9.65685 15 11 13.6569 11 12H13C13.5523 12 14 11.5523 14 11V10.4142C14 10.149 13.8946 9.89464 13.7071 9.70711L12.4393 8.43934C12.158 8.15804 12 7.7765 12 7.37868V5ZM6.5 12C6.5 12.8284 7.17157 13.5 8 13.5C8.82843 13.5 9.5 12.8284 9.5 12H6.5Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
