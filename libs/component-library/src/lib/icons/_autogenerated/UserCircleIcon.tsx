import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function UserCircleIcon(props: IconWrappedProps) {
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
          d="M15 8C15 11.866 11.866 15 8 15C4.13401 15 1 11.866 1 8C1 4.13401 4.13401 1 8 1C11.866 1 15 4.13401 15 8ZM10 6C10 7.10457 9.10457 8 8 8C6.89543 8 6 7.10457 6 6C6 4.89543 6.89543 4 8 4C9.10457 4 10 4.89543 10 6ZM7.99913 9C6.17453 9 4.5782 9.97733 3.70508 11.437C4.71303 12.6947 6.26204 13.5 7.99913 13.5C9.73623 13.5 11.2852 12.6947 12.2932 11.437C11.4201 9.97733 9.82373 9 7.99913 9Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
