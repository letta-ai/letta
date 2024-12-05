import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function SpaceDashboardHardIcon(props: IconWrappedProps) {
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
          d="M3 17.1667V3H17.1667V17.1667H3ZM4.25 15.9167H9.45833V4.25H4.25V15.9167ZM10.7083 15.9167H15.9167V10.0833H10.7083V15.9167ZM10.7083 8.83333H15.9167V4.25H10.7083V8.83333Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
