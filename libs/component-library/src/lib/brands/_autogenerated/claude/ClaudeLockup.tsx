import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

export function ClaudeLockup() {
  return <Image src={image} alt="Claude Lockup" />;
}
