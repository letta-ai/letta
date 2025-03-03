import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface SnorkelAiLogoMarkProps {
  width?: number;
  height?: number;
}

export function SnorkelAiLogoMark(props: SnorkelAiLogoMarkProps) {
  return <Image src={image} alt="SnorkelAi LogoMark" {...props} />;
}
