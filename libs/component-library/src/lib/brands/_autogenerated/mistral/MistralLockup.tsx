import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

export function MistralLockup() {
  return <Image src={image} alt="Mistral Lockup" />;
}
