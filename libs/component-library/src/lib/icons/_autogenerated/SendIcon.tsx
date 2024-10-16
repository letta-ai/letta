import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function SendIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        fill="currentColor"
      >
        <path d="M144-192v-576l720 288-720 288Zm72-107 454-181-454-181v109l216 72-216 72v109Zm0 0v-362 362Z" />
      </svg>
    </IconWrapper>
  );
}
