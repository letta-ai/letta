import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

export function MistralLogoMark() {
  return <Image src={image} alt="Mistral LogoMark" />;
}
