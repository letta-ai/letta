import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ShieldExclamationIcon(props: IconWrappedProps) {
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
          d="M7.49981 1.70873C7.78457 1.45386 8.21543 1.45386 8.50019 1.70873C9.8219 2.89169 11.4937 3.6889 13.3401 3.92627C13.7049 3.97316 13.9819 4.27764 13.9941 4.64522C13.998 4.7631 14 4.88145 14 5.00023C14 9.05223 11.7046 12.5669 8.34664 14.317C8.12941 14.4302 7.87059 14.4302 7.65336 14.317C4.29542 12.5669 2 9.05223 2 5.00023C2 4.88145 2.00198 4.7631 2.0059 4.64521C2.01813 4.27764 2.29508 3.97316 2.65985 3.92627C4.50633 3.6889 6.1781 2.89169 7.49981 1.70873ZM8 5C8.41421 5 8.75 5.33579 8.75 5.75V7.75C8.75 8.16421 8.41421 8.5 8 8.5C7.58579 8.5 7.25 8.16421 7.25 7.75V5.75C7.25 5.33579 7.58579 5 8 5ZM8 12C8.55228 12 9 11.5523 9 11C9 10.4477 8.55228 10 8 10C7.44772 10 7 10.4477 7 11C7 11.5523 7.44772 12 8 12Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
