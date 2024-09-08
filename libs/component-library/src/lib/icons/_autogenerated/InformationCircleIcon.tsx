import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function InformationCircleIcon(props: IconWrappedProps) {
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
          d="M15 8C15 11.866 11.866 15 8 15C4.13401 15 1 11.866 1 8C1 4.13401 4.13401 1 8 1C11.866 1 15 4.13401 15 8ZM9 5C9 5.55228 8.55228 6 8 6C7.44772 6 7 5.55228 7 5C7 4.44772 7.44772 4 8 4C8.55228 4 9 4.44772 9 5ZM6.75 8C6.33579 8 6 8.33579 6 8.75C6 9.16421 6.33579 9.5 6.75 9.5H7.5V11.25C7.5 11.6642 7.83579 12 8.25 12C8.66421 12 9 11.6642 9 11.25V8.75C9 8.33579 8.66421 8 8.25 8H6.75Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
