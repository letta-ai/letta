import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface ComposioLockupProps {
  width?: number;
  height?: number;
}

export function ComposioLockup(props: ComposioLockupProps) {
  return <Image src={image} alt="Composio Logo" {...props} />;
}
