import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function TemplateIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M22 22H5V5H22V22ZM9.5 17.5V19H11V17.5H9.5ZM16 17.5V19H17.5V17.5H16ZM11 9V11H9V16H11V17.5H12.5V16H14.5V17.5H16V16H18V11H16V9H14.5V10H12.5V9H11ZM12.5 13V15H11V13H12.5ZM16 13V15H14.5V13H16Z"
          fill="currentColor"
        />
        <path d="M20 3.5H18.5H3.5V18.5V20H2V2H20V3.5Z" fill="currentColor" />
      </svg>
    </IconWrapper>
  );
}
