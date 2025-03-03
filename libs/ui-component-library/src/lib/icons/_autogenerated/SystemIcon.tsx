import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function SystemIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        fill="currentColor"
      >
        <path d="M144-144v-672h672v672H144Zm72-72h528v-456H216v456Zm72-265v-72h384v72H288Zm0 145v-72h240v72H288Z" />
      </svg>
    </IconWrapper>
  );
}
