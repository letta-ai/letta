import * as React from 'react';
import type { IconWrappedProps } from '../IconWrapper';
import { IconWrapper } from '../IconWrapper';

export function ChatBubbleOvalLeftEllipsisIcon(props: IconWrappedProps) {
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
          d="M8 2C4.26184 2 1 4.5691 1 8C1 9.86014 1.97915 11.4858 3.45459 12.5659C3.38055 13.0221 3.21838 13.4482 2.98605 13.8269C2.83711 14.0698 2.83857 14.376 2.98983 14.6174C3.1411 14.8587 3.41604 14.9936 3.6995 14.9654C4.81757 14.8544 5.85852 14.4801 6.7588 13.9061C7.16215 13.9679 7.57698 14 8 14C11.7382 14 15 11.4309 15 8C15 4.5691 11.7382 2 8 2ZM5 9C5.55228 9 6 8.55228 6 8C6 7.44772 5.55228 7 5 7C4.44772 7 4 7.44772 4 8C4 8.55228 4.44772 9 5 9ZM12 8C12 8.55228 11.5523 9 11 9C10.4477 9 10 8.55228 10 8C10 7.44772 10.4477 7 11 7C11.5523 7 12 7.44772 12 8ZM8 9C8.55228 9 9 8.55228 9 8C9 7.44772 8.55228 7 8 7C7.44772 7 7 7.44772 7 8C7 8.55228 7.44772 9 8 9Z"
          fill="black"
        />
      </svg>
    </IconWrapper>
  );
}
