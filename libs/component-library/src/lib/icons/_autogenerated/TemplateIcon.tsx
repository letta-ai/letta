import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function TemplateIcon(props: IconWrappedProps) {
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
          d="M4.91667 14.5V2H17.4167V14.5H4.91667ZM6.16667 13.25H16.1667V6.18271H10.654V3.25H6.16667V13.25ZM2 17.4167V5.17313H3.25V16.1667H14.2435V17.4167H2Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
