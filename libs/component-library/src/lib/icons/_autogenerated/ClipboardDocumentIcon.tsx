import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ClipboardDocumentIcon(props: IconWrappedProps) {
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
          d="M11.9863 3H12C13.1046 3 14 3.89543 14 5V11C14 11.9319 13.3626 12.715 12.5 12.937V10.4142C12.5 9.75117 12.2366 9.11529 11.7678 8.64645L8.35356 5.23223C7.88472 4.76339 7.24884 4.5 6.5858 4.5H4.06302C4.28504 3.63739 5.06809 3 6.00001 3H6.01374C6.1381 1.87501 7.09187 1 8.25001 1H9.75001C10.9081 1 11.8619 1.87501 11.9863 3ZM10.5 4V3.25C10.5 2.83579 10.1642 2.5 9.75001 2.5H8.25001C7.8358 2.5 7.50001 2.83579 7.50001 3.25V4H10.5Z"
          fill="black"
        />
        <path
          d="M3 6C2.44772 6 2 6.44771 2 7V14C2 14.5523 2.44772 15 3 15H10C10.5523 15 11 14.5523 11 14V10.4142C11 10.149 10.8946 9.89464 10.7071 9.70711L7.29289 6.29289C7.10536 6.10536 6.851 6 6.58579 6H3Z"
          fill="black"
        />
      </svg>
    </IconWrapper>
  );
}
