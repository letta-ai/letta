import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

export function LlamaLogoMark() {
  return <Image src={image} alt="Llama LogoMark" />;
}
