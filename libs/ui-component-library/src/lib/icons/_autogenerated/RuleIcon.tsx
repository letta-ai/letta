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
        <path d="m579-192-51-51 93-93-93-93 51-51 93 93 93-93 51 51-93 93 93 93-51 51-93-93-93 93Zm64-336L507-664l51-51 85 85 169-170 52 51-221 221ZM96-288v-72h336v72H96Zm0-312v-72h336v72H96Z" />
      </svg>
    </IconWrapper>
  );
}
