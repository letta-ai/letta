import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface GoogleAiLogoMarkProps {
  width?: number;
  height?: number;
}

export function GoogleAiLogoMark(props: GoogleAiLogoMarkProps) {
  return <Image src={image} alt="GoogleAi LogoMark" {...props} />;
}
