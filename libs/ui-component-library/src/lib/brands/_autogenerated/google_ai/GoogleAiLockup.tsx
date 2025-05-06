import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface GoogleAiLockupProps {
  width?: number;
  height?: number;
}

export function GoogleAiLockup(props: GoogleAiLockupProps) {
  return <Image src={image} alt="GoogleAi Logo" {...props} />;
}
