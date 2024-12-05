import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function FolderIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        fill="currentColor"
      >
        <path d="M96-192v-576h288l96 96h384v480H96Zm72-72h624v-336H450l-96-96H168v432Zm0 0v-432 432Z" />
      </svg>
    </IconWrapper>
  );
}
