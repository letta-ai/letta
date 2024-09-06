import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function TableCellsIcon(props: IconWrappedProps) {
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
          d="M15 11C15 12.1046 14.1046 13 13 13H3C1.89543 13 1 12.1046 1 11V5C1 3.89543 1.89543 3 3 3H13C14.1046 3 15 3.89543 15 5V11ZM7.25 7.5C7.25 7.22386 7.02614 7 6.75 7H3C2.72386 7 2.5 7.22386 2.5 7.5V8C2.5 8.27614 2.72386 8.5 3 8.5H6.75C7.02614 8.5 7.25 8.27614 7.25 8V7.5ZM8.75 10.5C8.75 10.2239 8.97386 10 9.25 10H13C13.2761 10 13.5 10.2239 13.5 10.5V11C13.5 11.2761 13.2761 11.5 13 11.5H9.25C8.97386 11.5 8.75 11.2761 8.75 11V10.5ZM13.5 8V7.5C13.5 7.22386 13.2761 7 13 7H9.25C8.97386 7 8.75 7.22386 8.75 7.5V8C8.75 8.27614 8.97386 8.5 9.25 8.5H13C13.2761 8.5 13.5 8.27614 13.5 8ZM6.75 11.5C7.02614 11.5 7.25 11.2761 7.25 11V10.5C7.25 10.2239 7.02614 10 6.75 10H3C2.72386 10 2.5 10.2239 2.5 10.5V11C2.5 11.2761 2.72386 11.5 3 11.5H6.75Z"
          fill="black"
        />
      </svg>
    </IconWrapper>
  );
}
