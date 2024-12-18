import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface TogetherAiLogoMarkProps {
  width?: number;
  height?: number;
}

export function TogetherAiLogoMark(props: TogetherAiLogoMarkProps) {
  return <Image src={image} alt="TogetherAi LogoMark" {...props} />;
}
