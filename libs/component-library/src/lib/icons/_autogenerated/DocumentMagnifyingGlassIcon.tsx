import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function DocumentMagnifyingGlassIcon(props: IconWrappedProps) {
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
          d="M6 7.5C6 6.67157 6.67157 6 7.5 6C8.32843 6 9 6.67157 9 7.5C9 7.91442 8.83293 8.28839 8.56066 8.56066C8.28839 8.83293 7.91442 9 7.5 9C6.67157 9 6 8.32843 6 7.5Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4 2C3.17157 2 2.5 2.67157 2.5 3.5V12.5C2.5 13.3284 3.17157 14 4 14H12C12.8284 14 13.5 13.3284 13.5 12.5V6.62132C13.5 6.2235 13.342 5.84197 13.0607 5.56066L9.93934 2.43934C9.65804 2.15804 9.2765 2 8.87868 2H4ZM7.5 4.5C5.84315 4.5 4.5 5.84315 4.5 7.5C4.5 9.15685 5.84315 10.5 7.5 10.5C8.05604 10.5 8.57728 10.3483 9.02386 10.0845L10.2197 11.2803C10.5126 11.5732 10.9874 11.5732 11.2803 11.2803C11.5732 10.9874 11.5732 10.5126 11.2803 10.2197L10.0845 9.02386C10.3483 8.57728 10.5 8.05604 10.5 7.5C10.5 5.84315 9.15685 4.5 7.5 4.5Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
