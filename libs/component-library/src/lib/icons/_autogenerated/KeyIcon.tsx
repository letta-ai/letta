import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function KeyIcon(props: IconWrappedProps) {
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
          d="M14 6C14 8.20914 12.2091 10 10 10C9.69101 10 9.39021 9.96497 9.10135 9.89865L7.14645 11.8536C7.05268 11.9473 6.9255 12 6.79289 12H5V13.5C5 13.7761 4.77614 14 4.5 14H2.5C2.22386 14 2 13.7761 2 13.5V11.2071C2 11.0745 2.05268 10.9473 2.14645 10.8536L6.10135 6.89865C6.03503 6.60979 6 6.30899 6 6C6 3.79086 7.79086 2 10 2C12.2091 2 14 3.79086 14 6ZM10 4C9.58579 4 9.25 4.33579 9.25 4.75C9.25 5.16421 9.58579 5.5 10 5.5C10.2761 5.5 10.5 5.72386 10.5 6C10.5 6.41421 10.8358 6.75 11.25 6.75C11.6642 6.75 12 6.41421 12 6C12 4.89543 11.1046 4 10 4Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
