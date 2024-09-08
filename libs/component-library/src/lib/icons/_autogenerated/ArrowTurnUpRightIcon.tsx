import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ArrowTurnUpRightIcon(props: IconWrappedProps) {
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
          d="M2.75 14C3.16421 14 3.5 13.6642 3.5 13.25V6.75H11.4393L10.4697 7.71967C10.1768 8.01256 10.1768 8.48744 10.4697 8.78033C10.7626 9.07322 11.2374 9.07322 11.5303 8.78033L13.7803 6.53033C14.0732 6.23744 14.0732 5.76256 13.7803 5.46967L11.5303 3.21967C11.2374 2.92678 10.7626 2.92678 10.4697 3.21967C10.1768 3.51256 10.1768 3.98744 10.4697 4.28033L11.4393 5.25H2.75C2.33579 5.25 2 5.58579 2 6V13.25C2 13.6642 2.33579 14 2.75 14Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
