import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function InboxIcon(props: IconWrappedProps) {
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
          d="M4.78373 3C3.85012 3 3.01349 3.57656 2.68113 4.44901L1.1474 8.47505C1.04995 8.73086 1 9.0023 1 9.27604V10.75C1 11.9926 2.00736 13 3.25 13H12.75C13.9926 13 15 11.9926 15 10.75V9.27604C15 9.0023 14.95 8.73086 14.8526 8.47505L13.3189 4.44901C12.9865 3.57656 12.1499 3 11.2163 3H4.78373ZM4.08286 4.983C4.19365 4.69219 4.47252 4.5 4.78373 4.5H11.2163C11.5275 4.5 11.8063 4.69219 11.9171 4.983L13.4474 9H11.0352C10.7008 9 10.3886 9.1671 10.2031 9.4453L9.79687 10.0547C9.6114 10.3329 9.29917 10.5 8.96482 10.5H7.03518C6.70083 10.5 6.3886 10.3329 6.20313 10.0547L5.79687 9.4453C5.6114 9.1671 5.29917 9 4.96482 9H2.55258L4.08286 4.983Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
