import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface OpenaiLockupProps {
  width?: number;
  height?: number;
}

export function OpenaiLockup(props: OpenaiLockupProps) {
  return <Image src={image} alt="Openai Logo" {...props} />;
}
