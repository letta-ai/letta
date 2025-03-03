// stub for NextLink
import type { HTMLProps } from 'react';

function Link(props: HTMLProps<HTMLAnchorElement>) {
  return <a {...props}>{props.children}</a>;
}

export default Link;
