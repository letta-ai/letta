import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

export function ComposioLogoMark() {
  return <Image src={image} alt="Composio LogoMark" />;
}
