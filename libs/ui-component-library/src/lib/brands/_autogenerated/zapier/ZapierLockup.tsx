import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface ZapierLockupProps {
  width?: number;
  height?: number;
}

export function ZapierLockup(props: ZapierLockupProps) {
  return <Image src={image} alt="Zapier Logo" {...props} />;
}
