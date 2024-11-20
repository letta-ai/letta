import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

export function OpenaiLogoMark() {
  return <Image src={image} alt="Openai LogoMark" />;
}
