import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function RssIcon(props: IconWrappedProps) {
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
          d="M2 2.75C2 2.33579 2.33579 2 2.75 2C8.9632 2 14 7.0368 14 13.25C14 13.6642 13.6642 14 13.25 14C12.8358 14 12.5 13.6642 12.5 13.25C12.5 7.86522 8.13478 3.5 2.75 3.5C2.33579 3.5 2 3.16421 2 2.75ZM2 7.25C2 6.83579 2.33579 6.5 2.75 6.5C6.47792 6.5 9.5 9.52208 9.5 13.25C9.5 13.6642 9.16421 14 8.75 14C8.33579 14 8 13.6642 8 13.25C8 10.3505 5.64949 8 2.75 8C2.33579 8 2 7.66421 2 7.25ZM3.5 11C2.67157 11 2 11.6716 2 12.5C2 13.3284 2.67157 14 3.5 14C4.32843 14 5 13.3284 5 12.5C5 11.6716 4.32843 11 3.5 11Z"
          fill="black"
        />
      </svg>
    </IconWrapper>
  );
}
