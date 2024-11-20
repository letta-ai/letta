import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

export function NvidiaLockup() {
  return <Image src={image} alt="Nvidia Lockup" />;
}
