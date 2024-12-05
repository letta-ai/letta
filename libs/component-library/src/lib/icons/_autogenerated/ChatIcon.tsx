import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ChatIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        fill="currentColor"
      >
        <path d="M96-96v-768h768v624H240L96-96Zm114-216h582v-480H168v522l42-42Zm-42 0v-480 480Zm72-72h336v-72H240v72Zm0-132h480v-72H240v72Zm0-132h480v-72H240v72Z" />
      </svg>
    </IconWrapper>
  );
}
