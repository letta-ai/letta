import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface TogetherAiLockupProps {
  width?: number;
  height?: number;
}

export function TogetherAiLockup(props: TogetherAiLockupProps) {
  return <Image src={image} alt="TogetherAi Logo" {...props} />;
}
