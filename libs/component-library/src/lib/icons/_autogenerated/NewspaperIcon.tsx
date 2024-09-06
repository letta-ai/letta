import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function NewspaperIcon(props: IconWrappedProps) {
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
          d="M10 3C10 2.44772 9.55229 2 9 2H3C2.44772 2 2 2.44772 2 3V12C2 13.1046 2.89543 14 4 14H12C10.8954 14 10 13.1046 10 12V3ZM4 4H8V6H4V4ZM8 7.5H4V9H8V7.5ZM4 10.5H8V12H4V10.5Z"
          fill="black"
        />
        <path
          d="M13 5H11.5V11.25C11.5 11.9404 12.0596 12.5 12.75 12.5C13.4404 12.5 14 11.9404 14 11.25V6C14 5.44772 13.5523 5 13 5Z"
          fill="black"
        />
      </svg>
    </IconWrapper>
  );
}
