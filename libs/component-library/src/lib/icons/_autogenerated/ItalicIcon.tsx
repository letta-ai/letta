import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ItalicIcon(props: IconWrappedProps) {
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
          d="M6.25 2.75C6.25 2.33579 6.58579 2 7 2H13C13.4142 2 13.75 2.33579 13.75 2.75C13.75 3.16421 13.4142 3.5 13 3.5H10.5169L7.08829 12.5H9C9.41421 12.5 9.75 12.8358 9.75 13.25C9.75 13.6642 9.41421 14 9 14H3C2.58579 14 2.25 13.6642 2.25 13.25C2.25 12.8358 2.58579 12.5 3 12.5H5.48314L8.91171 3.5H7C6.58579 3.5 6.25 3.16421 6.25 2.75Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
