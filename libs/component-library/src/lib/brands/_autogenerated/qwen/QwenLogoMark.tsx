import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

export function QwenLogoMark() {
  return <Image src={image} alt="Qwen LogoMark" />;
}
