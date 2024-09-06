import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ArrowUturnLeftIcon(props: IconWrappedProps) {
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
          d="M12.5 9.75C12.5 8.23122 11.2688 7 9.75 7H4.56066L6.78033 9.21967C7.07322 9.51256 7.07322 9.98744 6.78033 10.2803C6.48744 10.5732 6.01256 10.5732 5.71967 10.2803L2.21967 6.78033C1.92678 6.48744 1.92678 6.01256 2.21967 5.71967L5.71967 2.21967C6.01256 1.92678 6.48744 1.92678 6.78033 2.21967C7.07322 2.51256 7.07322 2.98744 6.78033 3.28033L4.56066 5.5L9.75 5.5C12.0972 5.5 14 7.40279 14 9.75C14 12.0972 12.0972 14 9.75 14H8.75C8.33579 14 8 13.6642 8 13.25C8 12.8358 8.33579 12.5 8.75 12.5H9.75C11.2688 12.5 12.5 11.2688 12.5 9.75Z"
          fill="#0F172A"
        />
      </svg>
    </IconWrapper>
  );
}
