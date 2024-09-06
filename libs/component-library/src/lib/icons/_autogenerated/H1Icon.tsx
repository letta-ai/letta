import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function H1Icon(props: IconWrappedProps) {
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
          d="M1.75 3C2.16421 3 2.5 3.33579 2.5 3.75V7.25H6.5V3.75C6.5 3.33579 6.83579 3 7.25 3C7.66421 3 8 3.33579 8 3.75V12.25C8 12.6642 7.66421 13 7.25 13C6.83579 13 6.5 12.6642 6.5 12.25V8.75H2.5V12.25C2.5 12.6642 2.16421 13 1.75 13C1.33579 13 1 12.6642 1 12.25V3.75C1 3.33579 1.33579 3 1.75 3ZM10 6.75C10 6.33579 10.3358 6 10.75 6H12.5C12.9142 6 13.25 6.33579 13.25 6.75V11.5H14.25C14.6642 11.5 15 11.8358 15 12.25C15 12.6642 14.6642 13 14.25 13H10.75C10.3358 13 10 12.6642 10 12.25C10 11.8358 10.3358 11.5 10.75 11.5H11.75V7.5H10.75C10.3358 7.5 10 7.16421 10 6.75Z"
          fill="black"
        />
      </svg>
    </IconWrapper>
  );
}
