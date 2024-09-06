import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function UnderlineIcon(props: IconWrappedProps) {
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
          d="M4.75 2C5.16421 2 5.5 2.33579 5.5 2.75V7C5.5 8.38071 6.61929 9.5 8 9.5C9.38071 9.5 10.5 8.38071 10.5 7V2.75C10.5 2.33579 10.8358 2 11.25 2C11.6642 2 12 2.33579 12 2.75V7C12 9.20914 10.2091 11 8 11C5.79086 11 4 9.20914 4 7V2.75C4 2.33579 4.33579 2 4.75 2ZM2 13.25C2 12.8358 2.33579 12.5 2.75 12.5H13.25C13.6642 12.5 14 12.8358 14 13.25C14 13.6642 13.6642 14 13.25 14H2.75C2.33579 14 2 13.6642 2 13.25Z"
          fill="black"
        />
      </svg>
    </IconWrapper>
  );
}
