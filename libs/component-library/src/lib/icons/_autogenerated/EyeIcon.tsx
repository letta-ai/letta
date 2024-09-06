import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function EyeIcon(props: IconWrappedProps) {
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
          d="M8 9.5C8.82843 9.5 9.5 8.82843 9.5 8C9.5 7.17157 8.82843 6.5 8 6.5C7.17157 6.5 6.5 7.17157 6.5 8C6.5 8.82843 7.17157 9.5 8 9.5Z"
          fill="#0F172A"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M1.3794 8.28049C1.31616 8.09687 1.31625 7.89727 1.37965 7.71371C2.32719 4.97038 4.93238 3 7.99777 3C11.0653 3 13.672 4.97316 14.6179 7.71951C14.6811 7.90313 14.681 8.10274 14.6176 8.2863C13.6701 11.0296 11.0649 13 7.99952 13C4.93197 13 2.32527 11.0268 1.3794 8.28049ZM11 8C11 9.65685 9.65685 11 8 11C6.34315 11 5 9.65685 5 8C5 6.34315 6.34315 5 8 5C9.65685 5 11 6.34315 11 8Z"
          fill="#0F172A"
        />
      </svg>
    </IconWrapper>
  );
}
