import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface TogetherLockupProps {
  width?: number;
  height?: number;
}

export function TogetherLockup(props: TogetherLockupProps) {
  return <Image src={image} alt="Together Logo" {...props} />;
}
