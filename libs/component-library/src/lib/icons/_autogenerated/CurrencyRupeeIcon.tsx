import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function CurrencyRupeeIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M15 8C15 11.866 11.866 15 8 15C4.13401 15 1 11.866 1 8C1 4.13401 4.13401 1 8 1C11.866 1 15 4.13401 15 8ZM4.75 4C4.33579 4 4 4.33579 4 4.75C4 5.16421 4.33579 5.5 4.75 5.5H6.50002C7.19812 5.5 7.80075 5.90876 8.08161 6.5H4.75C4.33579 6.5 4 6.83579 4 7.25C4 7.66421 4.33579 8 4.75 8H8.08161C7.80075 8.59124 7.19812 9 6.50002 9H4.75002C4.44668 9 4.1732 9.18273 4.05711 9.46299C3.94103 9.74324 4.00519 10.0658 4.21969 10.2803L6.71969 12.7803C7.01259 13.0732 7.48746 13.0732 7.78035 12.7803C8.07325 12.4874 8.07325 12.0126 7.78035 11.7197L6.56014 10.4995C8.0703 10.4721 9.3289 9.41462 9.66306 8H11.25C11.6642 8 12 7.66421 12 7.25C12 6.83579 11.6642 6.5 11.25 6.5H9.66306C9.57797 6.13981 9.43295 5.80277 9.23911 5.5H11.25C11.6642 5.5 12 5.16421 12 4.75C12 4.33579 11.6642 4 11.25 4H4.75Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
