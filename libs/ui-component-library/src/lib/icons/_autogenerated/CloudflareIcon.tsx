import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function CloudflareIcon(props: IconWrappedProps) {
  return (
    <IconWrapper {...props}>
      <svg
        fill="currentColor"
        fillRule="evenodd"
        height="1em"
        style={{ flex: 'none', lineHeight: 1 }}
        viewBox="0 0 24 24"
        width="1em"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Cloudflare</title>
        <path d="M16.508 0C20.919 0 24 3.081 24 7.508c0 4.427-3.081 7.508-7.508 7.508H7.508C3.081 15.016 0 11.935 0 7.508 0 3.081 3.081 0 7.508 0h8.999zM7.508 2.5C4.465 2.5 2 4.965 2 8.008c0 3.043 2.465 5.508 5.508 5.508h8.999c3.043 0 5.508-2.465 5.508-5.508 0-3.043-2.465-5.508-5.508-5.508H7.508z" />
        <path d="M12 6.5c-2.5 0-4.5 2-4.5 4.5s2 4.5 4.5 4.5 4.5-2 4.5-4.5-2-4.5-4.5-4.5zm0 2c1.4 0 2.5 1.1 2.5 2.5s-1.1 2.5-2.5 2.5-2.5-1.1-2.5-2.5 1.1-2.5 2.5-2.5z" />
      </svg>
    </IconWrapper>
  );
}
