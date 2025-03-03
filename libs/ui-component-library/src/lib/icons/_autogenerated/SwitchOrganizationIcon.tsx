import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function SwitchOrganizationIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        fill="currentColor"
      >
        <path d="M48-144v-624h384v156h-72v-84H120v480h240v-84h72v156H48Zm480 0v-144h72v72h72v72H528Zm240 0v-72h72v-72h72v144H768ZM528-624v-144h144v72h-72v72h-72Zm312 0v-72h-72v-72h144v144h-72ZM120-216v-480 480Zm552-96-51-51 57-57H240v-72h438l-57-57 51-51 144 144-144 144Z" />
      </svg>
    </IconWrapper>
  );
}
