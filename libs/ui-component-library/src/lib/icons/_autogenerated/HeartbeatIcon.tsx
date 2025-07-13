import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function HeartbeatIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        width="24"
        height="18"
        viewBox="0 0 24 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M14.7666 0.00028169C15.2934 -0.0107754 15.7583 0.304748 15.8851 0.759437L18.35 9.6H23.25V11.6H17.4698C16.9528 11.6 16.5023 11.2867 16.3779 10.8406L14.9152 5.59455L12.3277 17.1945C12.2265 17.6479 11.7889 17.9806 11.2693 17.9992C10.7497 18.0177 10.2835 17.7173 10.1417 17.2725L7.64739 9.44491L7.1847 10.8762C7.04615 11.3048 6.60511 11.6 6.10345 11.6H0.75V9.6H5.2562L6.57393 5.52382C6.7127 5.09457 7.15486 4.79916 7.65731 4.8C8.15976 4.80085 8.60066 5.09776 8.73759 5.52747L11.031 12.7244L13.6896 0.805513C13.7921 0.346012 14.2397 0.0113388 14.7666 0.00028169Z"
          fill="#141414"
        />
      </svg>
    </IconWrapper>
  );
}
