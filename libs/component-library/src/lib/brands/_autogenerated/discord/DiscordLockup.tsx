import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface DiscordLockupProps {
  width?: number;
  height?: number;
}

export function DiscordLockup(props: DiscordLockupProps) {
  return <Image src={image} alt="Discord Logo" {...props} />;
}
