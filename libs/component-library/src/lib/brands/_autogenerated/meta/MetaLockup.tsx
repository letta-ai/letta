import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface MetaLockupProps {
  width?: number;
  height?: number;
}

export function MetaLockup(props: MetaLockupProps) {
  return <Image src={image} alt="Meta Logo" {...props} />;
}
