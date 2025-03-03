import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface NvidiaLockupProps {
  width?: number;
  height?: number;
}

export function NvidiaLockup(props: NvidiaLockupProps) {
  return <Image src={image} alt="Nvidia Logo" {...props} />;
}
