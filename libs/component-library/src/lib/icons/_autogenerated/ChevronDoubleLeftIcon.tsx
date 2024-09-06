import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ChevronDoubleLeftIcon(props: IconWrappedProps) {
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
          d="M3.21967 7.59467C2.92678 7.88756 2.92678 8.36244 3.21967 8.65533L6.46967 11.9053C6.76256 12.1982 7.23744 12.1982 7.53033 11.9053C7.82322 11.6124 7.82322 11.1376 7.53033 10.8447L4.81066 8.125L7.53033 5.40533C7.82322 5.11244 7.82322 4.63756 7.53033 4.34467C7.23744 4.05178 6.76256 4.05178 6.46967 4.34467L3.21967 7.59467ZM11.4697 4.34467L8.21967 7.59467C7.92678 7.88756 7.92678 8.36244 8.21967 8.65533L11.4697 11.9053C11.7626 12.1982 12.2374 12.1982 12.5303 11.9053C12.8232 11.6124 12.8232 11.1376 12.5303 10.8447L9.81066 8.125L12.5303 5.40533C12.8232 5.11244 12.8232 4.63756 12.5303 4.34467C12.2374 4.05178 11.7626 4.05178 11.4697 4.34467Z"
          fill="black"
        />
      </svg>
    </IconWrapper>
  );
}
