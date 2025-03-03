import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface LmstudioLockupProps {
  width?: number;
  height?: number;
}

export function LmstudioLockup(props: LmstudioLockupProps) {
  return <Image src={image} alt="Lmstudio Logo" {...props} />;
}
