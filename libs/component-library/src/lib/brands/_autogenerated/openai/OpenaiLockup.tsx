import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

export function OpenaiLockup() {
  return <Image src={image} alt="Openai Lockup" />;
}
