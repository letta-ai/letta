import type { HTMLProps } from 'react';
import type { ImageProps } from 'next/image';

export function Image(props: HTMLProps<ImageProps>) {
  return <img src={props.src} alt={props.alt} />;
}
