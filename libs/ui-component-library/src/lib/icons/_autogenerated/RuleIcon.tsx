import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function RuleIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        fill="currentColor"
      >
        <path d="M576-168v-84H444v-192h-60v84H96v-240h288v84h60v-192h132v-84h288v240H576v-84h-60v312h60v-84h288v240H576Zm72-72h144v-96H648v96ZM168-432h144v-96H168v96Zm480-192h144v-96H648v96Zm0 384v-96 96ZM312-432v-96 96Zm336-192v-96 96Z" />
      </svg>
    </IconWrapper>
  );
}
