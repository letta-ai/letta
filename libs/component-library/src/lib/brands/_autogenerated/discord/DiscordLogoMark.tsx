import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface DiscordLogoMarkProps {
  width?: number;
  height?: number;
}

export function DiscordLogoMark(props: DiscordLogoMarkProps) {
  return <Image src={image} alt="Discord LogoMark" {...props} />;
}
