import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface GeminiLockupProps {
  width?: number;
  height?: number;
}

export function GeminiLockup(props: GeminiLockupProps) {
  return <Image src={image} alt="Gemini Logo" {...props} />;
}
