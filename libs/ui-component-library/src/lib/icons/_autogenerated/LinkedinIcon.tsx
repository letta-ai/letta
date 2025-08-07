import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function LinkedinIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3.31862 13.6667H0.553734V4.76488H3.31862V13.6667ZM1.93469 3.55059C1.05076 3.55059 0.333496 2.81845 0.333496 1.93452C0.333496 1.05059 1.05076 0.333328 1.93469 0.333328C2.81862 0.333328 3.53588 1.05059 3.53588 1.93452C3.53588 2.81845 2.81862 3.55059 1.93469 3.55059ZM13.6668 13.6667H10.9079V9.33333C10.9079 8.30059 10.8871 6.97619 9.4704 6.97619C8.0329 6.97619 7.81266 8.09821 7.81266 9.25892V13.6667H5.05076V4.76488H7.70254V5.97916H7.74123C8.11028 5.27976 9.01207 4.54166 10.3573 4.54166C13.1549 4.54166 13.6698 6.38392 13.6698 8.77678V13.6667H13.6668Z"
          fill="#C9CDD1"
        />
      </svg>
    </IconWrapper>
  );
}
