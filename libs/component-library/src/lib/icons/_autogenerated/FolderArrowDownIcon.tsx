import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function FolderArrowDownIcon(props: IconWrappedProps) {
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
          d="M3.5 2C2.67157 2 2 2.67157 2 3.5V12.5C2 13.3284 2.67157 14 3.5 14H12.5C13.3284 14 14 13.3284 14 12.5V5.5C14 4.67157 13.3284 4 12.5 4H9.62132C9.2235 4 8.84196 3.84197 8.56066 3.56066L7.43934 2.43934C7.15804 2.15804 6.7765 2 6.37868 2H3.5ZM8.75 6.75C8.75 6.33579 8.41421 6 8 6C7.58579 6 7.25 6.33579 7.25 6.75V9.43934L6.53033 8.71967C6.23744 8.42678 5.76256 8.42678 5.46967 8.71967C5.17678 9.01256 5.17678 9.48744 5.46967 9.78033L7.46967 11.7803C7.76256 12.0732 8.23744 12.0732 8.53033 11.7803L10.5303 9.78033C10.8232 9.48744 10.8232 9.01256 10.5303 8.71967C10.2374 8.42678 9.76256 8.42678 9.46967 8.71967L8.75 9.43934V6.75Z"
          fill="black"
        />
      </svg>
    </IconWrapper>
  );
}
