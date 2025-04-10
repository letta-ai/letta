import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function SubdirectoryArrowRightIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        fill="000"
      >
        <path d="m576-192-51-51 129-129H240v-444h72v372h342L525-573l51-51 216 216-216 216Z" />
      </svg>
    </IconWrapper>
  );
}
