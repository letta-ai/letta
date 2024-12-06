import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ClipboardIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        fill="currentColor"
      >
        <path d="M288-240v-624h528v624H288Zm72-72h384v-480H360v480ZM144-96v-624h72v552h456v72H144Zm216-216v-480 480Z" />
      </svg>
    </IconWrapper>
  );
}
