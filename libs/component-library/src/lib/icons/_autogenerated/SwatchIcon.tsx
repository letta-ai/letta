import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function SwatchIcon(props: IconWrappedProps) {
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
          d="M2 3C2 2.44772 2.44772 2 3 2H6C6.55228 2 7 2.44772 7 3V11.5C7 12.8807 5.88071 14 4.5 14C3.11929 14 2 12.8807 2 11.5V3ZM5.25 11.5C5.25 11.9142 4.91421 12.25 4.5 12.25C4.08579 12.25 3.75 11.9142 3.75 11.5C3.75 11.0858 4.08579 10.75 4.5 10.75C4.91421 10.75 5.25 11.0858 5.25 11.5Z"
          fill="currentColor"
        />
        <path
          d="M8.5 11.0349L12.2776 7.25729C12.6682 6.86676 12.6682 6.2336 12.2776 5.84308L10.1563 3.72176C9.7658 3.33123 9.13264 3.33123 8.74211 3.72175L8.5 3.96387V11.0349Z"
          fill="currentColor"
        />
        <path
          d="M7.65625 14H12.9998C13.5521 14 13.9998 13.5523 13.9998 13V10C13.9998 9.44772 13.5521 9 12.9998 9H12.6562L7.65625 14Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
