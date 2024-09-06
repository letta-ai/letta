import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ServerIcon(props: IconWrappedProps) {
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
          d="M3.66489 3.58798C3.85973 2.66249 4.67621 2 5.62199 2H10.3764C11.3222 2 12.1387 2.66249 12.3335 3.58798L13.432 8.80576C12.9947 8.60929 12.5097 8.5 11.9992 8.5H3.9992C3.4887 8.5 3.00373 8.60929 2.56641 8.80576L3.66489 3.58798Z"
          fill="black"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4 10C2.89543 10 2 10.8954 2 12C2 13.1046 2.89543 14 4 14H12C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10H4ZM12 12.75C12.4142 12.75 12.75 12.4142 12.75 12C12.75 11.5858 12.4142 11.25 12 11.25C11.5858 11.25 11.25 11.5858 11.25 12C11.25 12.4142 11.5858 12.75 12 12.75ZM9.75 12C9.75 12.4142 9.41421 12.75 9 12.75C8.58579 12.75 8.25 12.4142 8.25 12C8.25 11.5858 8.58579 11.25 9 11.25C9.41421 11.25 9.75 11.5858 9.75 12Z"
          fill="black"
        />
      </svg>
    </IconWrapper>
  );
}
