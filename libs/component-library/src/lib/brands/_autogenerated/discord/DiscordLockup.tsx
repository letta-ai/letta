import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

export function DiscordLockup() {
  return <Image src={image} alt="Discord Lockup" />;
}
