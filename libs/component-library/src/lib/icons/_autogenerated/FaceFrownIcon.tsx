import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function FaceFrownIcon(props: IconWrappedProps) {
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
          d="M15 8C15 11.866 11.866 15 8 15C4.13401 15 1 11.866 1 8C1 4.13401 4.13401 1 8 1C11.866 1 15 4.13401 15 8ZM6 8C6.55228 8 7 7.32843 7 6.5C7 5.67157 6.55228 5 6 5C5.44772 5 5 5.67157 5 6.5C5 7.32843 5.44772 8 6 8ZM11 6.5C11 7.32843 10.5523 8 10 8C9.44771 8 9 7.32843 9 6.5C9 5.67157 9.44771 5 10 5C10.5523 5 11 5.67157 11 6.5ZM4.9948 12.3051C5.28769 12.598 5.76256 12.598 6.05546 12.3051C7.1294 11.2312 8.8706 11.2312 9.94454 12.3051C10.2374 12.598 10.7123 12.598 11.0052 12.3051C11.2981 12.0122 11.2981 11.5374 11.0052 11.2445C9.34548 9.58473 6.65452 9.58473 4.9948 11.2445C4.7019 11.5374 4.7019 12.0122 4.9948 12.3051Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
