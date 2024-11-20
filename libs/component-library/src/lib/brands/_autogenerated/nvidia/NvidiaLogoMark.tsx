import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

export function NvidiaLogoMark() {
  return <Image src={image} alt="Nvidia LogoMark" />;
}
