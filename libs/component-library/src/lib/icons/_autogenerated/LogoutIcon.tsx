import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function LogoutIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        fill="currentColor"
      >
        <path d="M144-144v-672h336v72H216v528h264v72H144Zm504-168-51-51 81-81H384v-72h294l-81-81 51-51 168 168-168 168Z" />
      </svg>
    </IconWrapper>
  );
}
