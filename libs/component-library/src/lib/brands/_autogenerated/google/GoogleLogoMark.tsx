import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

export function GoogleLogoMark() {
  return <Image src={image} alt="Google LogoMark" />;
}
