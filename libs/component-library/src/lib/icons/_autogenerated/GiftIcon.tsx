import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function GiftIcon(props: IconWrappedProps) {
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
          d="M3.75 3.5C3.75 4.0628 3.93597 4.58217 4.24982 5H2C1.44772 5 1 5.44772 1 6C1 6.55228 1.44772 7 2 7H7.25V5H8.75V7H14C14.5523 7 15 6.55228 15 6C15 5.44772 14.5523 5 14 5H11.7492C12.0631 4.58217 12.249 4.0628 12.249 3.5C12.249 2.11929 11.1297 1 9.74902 1C9.06791 1 8.45041 1.27238 7.99951 1.71416C7.54862 1.27238 6.93112 1 6.25 1C4.86929 1 3.75 2.11929 3.75 3.5ZM7.24902 3.5L7.2493 3.46229C7.22947 2.92748 6.78966 2.5 6.25 2.5C5.69772 2.5 5.25 2.94772 5.25 3.5C5.25 4.05228 5.69772 4.5 6.25 4.5H7.24936L7.24902 3.5ZM9.74902 2.5C9.20937 2.5 8.76955 2.92748 8.74972 3.46229L8.75 3.5V4.5H9.74902C10.3013 4.5 10.749 4.05228 10.749 3.5C10.749 2.94772 10.3013 2.5 9.74902 2.5Z"
          fill="currentColor"
        />
        <path
          d="M7.25 8.5H2V12C2 13.1046 2.89543 14 4 14H7.25V8.5Z"
          fill="currentColor"
        />
        <path
          d="M8.75 14V8.5H14V12C14 13.1046 13.1046 14 12 14H8.75Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
