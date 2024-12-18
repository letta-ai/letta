import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface OpenaiLogoMarkProps {
  width?: number;
  height?: number;
}

export function OpenaiLogoMark(props: OpenaiLogoMarkProps) {
  return <Image src={image} alt="Openai LogoMark" {...props} />;
}
