import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function BriefcaseIcon(props: IconWrappedProps) {
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
          d="M11 4V3C11 1.89543 10.1046 1 9 1H7C5.89543 1 5 1.89543 5 3V4H4C2.89543 4 2 4.89543 2 6V9C2 10.1046 2.89543 11 4 11H12C13.1046 11 14 10.1046 14 9V6C14 4.89543 13.1046 4 12 4H11ZM9 2.5H7C6.72386 2.5 6.5 2.72386 6.5 3V4H9.5V3C9.5 2.72386 9.27614 2.5 9 2.5ZM9 9C9 9.55228 8.55228 10 8 10C7.44772 10 7 9.55228 7 9C7 8.44772 7.44772 8 8 8C8.55228 8 9 8.44772 9 9Z"
          fill="currentColor"
        />
        <path
          d="M3 11.8291V11.9998C3 13.1044 3.89543 13.9998 5 13.9998H11C12.1046 13.9998 13 13.1044 13 11.9998V11.8291C12.6872 11.9397 12.3506 11.9998 12 11.9998H4C3.64936 11.9998 3.31278 11.9397 3 11.8291Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
