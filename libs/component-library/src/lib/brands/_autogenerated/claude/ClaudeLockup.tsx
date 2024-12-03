import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface ClaudeLockupProps {
  width?: number;
  height?: number;
}

export function ClaudeLockup(props: ClaudeLockupProps) {
  return <Image src={image} alt="Claude Logo" {...props} />;
}
