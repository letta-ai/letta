import type { HTMLProps } from 'react';

export function Link(props: HTMLProps<HTMLAnchorElement>) {
  return <a {...props}>{props.children}</a>;
}
