import React from 'react';
import Image from 'next/image';
import image from './lockup.png';

interface SnorkelAiLockupProps {
  width?: number;
  height?: number;
}

export function SnorkelAiLockup(props: SnorkelAiLockupProps) {
  return <Image src={image} alt="SnorkelAi Logo" {...props} />;
}
