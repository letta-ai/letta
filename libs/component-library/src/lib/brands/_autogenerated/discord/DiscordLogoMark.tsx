import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

export function DiscordLogoMark() {
  return <Image src={image} alt="Discord LogoMark" />;
}
