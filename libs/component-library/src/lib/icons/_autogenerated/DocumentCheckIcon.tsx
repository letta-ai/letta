import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function DocumentCheckIcon(props: IconWrappedProps) {
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
          d="M4 2C3.17157 2 2.5 2.67157 2.5 3.5V12.5C2.5 13.3284 3.17157 14 4 14H12C12.8284 14 13.5 13.3284 13.5 12.5V6.62132C13.5 6.2235 13.342 5.84197 13.0607 5.56066L9.93934 2.43934C9.65804 2.15804 9.2765 2 8.87868 2H4ZM10.7134 6.16023C11.0391 6.41614 11.0957 6.88763 10.8398 7.21334L8.08975 10.7133C7.96343 10.8741 7.77695 10.9763 7.57347 10.9964C7.36999 11.0164 7.16716 10.9525 7.01192 10.8194L5.26192 9.31941C4.94743 9.04985 4.911 8.57637 5.18057 8.26188C5.45014 7.94738 5.92361 7.91096 6.23811 8.18053L7.39384 9.17116L9.66027 6.2866C9.91619 5.9609 10.3877 5.90432 10.7134 6.16023Z"
          fill="black"
        />
      </svg>
    </IconWrapper>
  );
}
