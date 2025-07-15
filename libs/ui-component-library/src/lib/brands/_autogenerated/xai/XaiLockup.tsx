import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface XaiLockupProps {
  width?: number;
  height?: number;
}

export function XaiLockup(props: XaiLockupProps) {
  return <Image src={image} alt="Xai Logo" {...props} />;
}
