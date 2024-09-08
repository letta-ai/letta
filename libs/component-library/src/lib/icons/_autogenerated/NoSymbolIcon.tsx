import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function NoSymbolIcon(props: IconWrappedProps) {
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
          d="M3.05025 3.05025C5.78392 0.316582 10.2161 0.316582 12.9497 3.05025C15.6834 5.78392 15.6834 10.2161 12.9497 12.9497C10.2161 15.6834 5.78392 15.6834 3.05025 12.9497C0.316582 10.2161 0.316582 5.78392 3.05025 3.05025ZM4.6771 3.61644L12.3836 11.3229C14.0219 9.16724 13.8571 6.07891 11.8891 4.11091C9.92109 2.14292 6.83276 1.9781 4.6771 3.61644ZM11.3229 12.3836L3.61644 4.6771C1.9781 6.83276 2.14292 9.92109 4.11091 11.8891C6.07891 13.8571 9.16724 14.0219 11.3229 12.3836Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
