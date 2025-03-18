import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function SegmentIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        fill="currentColor"
      >
        <path d="M384-240v-72h432v72H384Zm0-204v-72h432v72H384ZM144-648v-72h672v72H144Z" />
      </svg>
    </IconWrapper>
  );
}
