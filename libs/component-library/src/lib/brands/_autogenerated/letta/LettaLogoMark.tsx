import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

export function LettaLogoMark() {
  return <Image src={image} alt="Letta LogoMark" />;
}
