import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function TagIcon(props: IconWrappedProps) {
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
          d="M4.5 2C3.11929 2 2 3.11929 2 4.5V7.37868C2 8.04172 2.26339 8.67761 2.73223 9.14645L7.23223 13.6464C8.20854 14.6228 9.79145 14.6228 10.7678 13.6464L13.6464 10.7678C14.6228 9.79146 14.6228 8.20855 13.6464 7.23223L9.14645 2.73223C8.67761 2.26339 8.04172 2 7.37868 2H4.5ZM5 6C5.55228 6 6 5.55228 6 5C6 4.44772 5.55228 4 5 4C4.44772 4 4 4.44772 4 5C4 5.55228 4.44772 6 5 6Z"
          fill="#0F172A"
        />
      </svg>
    </IconWrapper>
  );
}
