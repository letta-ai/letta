import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ImageIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3.75 13.75H14.3268L11.0385 9.3655L8.23075 13.0192L6.23075 10.4615L3.75 13.75ZM0.5 17.5V0.5H17.5V17.5H0.5ZM2 16H16V2H2V16ZM5.49875 6.75C5.84575 6.75 6.141 6.62858 6.3845 6.38575C6.62817 6.14292 6.75 5.84808 6.75 5.50125C6.75 5.15425 6.62858 4.859 6.38575 4.6155C6.14292 4.37183 5.84808 4.25 5.50125 4.25C5.15425 4.25 4.859 4.37142 4.6155 4.61425C4.37183 4.85708 4.25 5.15192 4.25 5.49875C4.25 5.84575 4.37142 6.141 4.61425 6.3845C4.85708 6.62817 5.15192 6.75 5.49875 6.75Z"
          fill="#141414"
        />
      </svg>
    </IconWrapper>
  );
}
