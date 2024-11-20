import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

export function MetaLogoMark() {
  return <Image src={image} alt="Meta LogoMark" />;
}
