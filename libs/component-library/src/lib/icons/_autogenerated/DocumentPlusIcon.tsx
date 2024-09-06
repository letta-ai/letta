import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function DocumentPlusIcon(props: IconWrappedProps) {
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
          d="M4 2C3.17157 2 2.5 2.67157 2.5 3.5V12.5C2.5 13.3284 3.17157 14 4 14H12C12.8284 14 13.5 13.3284 13.5 12.5V6.62132C13.5 6.2235 13.342 5.84197 13.0607 5.56066L9.93934 2.43934C9.65804 2.15804 9.2765 2 8.87868 2H4ZM8.75 6.75C8.75 6.33579 8.41421 6 8 6C7.58579 6 7.25 6.33579 7.25 6.75V8.25H5.75C5.33579 8.25 5 8.58579 5 9C5 9.41421 5.33579 9.75 5.75 9.75H7.25V11.25C7.25 11.6642 7.58579 12 8 12C8.41421 12 8.75 11.6642 8.75 11.25V9.75H10.25C10.6642 9.75 11 9.41421 11 9C11 8.58579 10.6642 8.25 10.25 8.25H8.75V6.75Z"
          fill="black"
        />
      </svg>
    </IconWrapper>
  );
}
