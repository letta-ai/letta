import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface GeminiLogoMarkProps {
  width?: number;
  height?: number;
}

export function GeminiLogoMark(props: GeminiLogoMarkProps) {
  return <Image src={image} alt="Gemini LogoMark" {...props} />;
}
