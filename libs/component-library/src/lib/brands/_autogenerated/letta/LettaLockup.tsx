import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface LettaLockupProps {
  width?: number;
  height?: number;
}

export function LettaLockup(props: LettaLockupProps) {
  return <Image src={image} alt="Letta Logo" {...props} />;
}
