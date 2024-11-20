import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

export function ClaudeLogoMark() {
  return <Image src={image} alt="Claude LogoMark" />;
}
