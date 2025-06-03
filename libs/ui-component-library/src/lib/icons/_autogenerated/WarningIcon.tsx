import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function WarningIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        width="22"
        height="18"
        viewBox="0 0 22 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0.865479 17.5L11 0L21.1345 17.5H0.865479ZM11 14.8077C11.2288 14.8077 11.4206 14.7303 11.5755 14.5755C11.7303 14.4207 11.8077 14.2288 11.8077 14C11.8077 13.7712 11.7303 13.5793 11.5755 13.4245C11.4206 13.2697 11.2288 13.1923 11 13.1923C10.7711 13.1923 10.5793 13.2697 10.4245 13.4245C10.2696 13.5793 10.1922 13.7712 10.1922 14C10.1922 14.2288 10.2696 14.4207 10.4245 14.5755C10.5793 14.7303 10.7711 14.8077 11 14.8077ZM10.25 12.1923H11.75V7.19225H10.25V12.1923Z"
          fill="currentColor"
        />
      </svg>
    </IconWrapper>
  );
}
