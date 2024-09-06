import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function CameraIcon(props: IconWrappedProps) {
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
          d="M9.5 8.5C9.5 9.32843 8.82843 10 8 10C7.17157 10 6.5 9.32843 6.5 8.5C6.5 7.67157 7.17157 7 8 7C8.82843 7 9.5 7.67157 9.5 8.5Z"
          fill="black"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M2.5 5C1.67157 5 1 5.67157 1 6.5V11.5C1 12.3284 1.67157 13 2.5 13H13.5C14.3284 13 15 12.3284 15 11.5V6.5C15 5.67157 14.3284 5 13.5 5H12.6213C12.2235 5 11.842 4.84197 11.5607 4.56066L10.4393 3.43934C10.158 3.15804 9.7765 3 9.37868 3H6.62132C6.2235 3 5.84197 3.15803 5.56066 3.43934L4.43934 4.56066C4.15804 4.84196 3.7765 5 3.37868 5H2.5ZM11 8.5C11 10.1569 9.65685 11.5 8 11.5C6.34315 11.5 5 10.1569 5 8.5C5 6.84315 6.34315 5.5 8 5.5C9.65685 5.5 11 6.84315 11 8.5Z"
          fill="black"
        />
      </svg>
    </IconWrapper>
  );
}
