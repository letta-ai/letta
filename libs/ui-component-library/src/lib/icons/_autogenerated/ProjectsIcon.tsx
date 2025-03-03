import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ProjectsIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2.91602 9.16699V2.91699H9.16602V9.16699H2.91602ZM2.91602 17.0837V10.8337H9.16602V17.0837H2.91602ZM10.8327 9.16699V2.91699H17.0827V9.16699H10.8327ZM10.8327 17.0837V10.8337H17.0827V17.0837H10.8327ZM4.16602 7.91699H7.91602V4.16699H4.16602V7.91699ZM12.0827 7.91699H15.8327V4.16699H12.0827V7.91699ZM12.0827 15.8337H15.8327V12.0837H12.0827V15.8337ZM4.16602 15.8337H7.91602V12.0837H4.16602V15.8337Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
