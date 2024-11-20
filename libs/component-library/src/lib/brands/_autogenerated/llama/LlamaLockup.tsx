import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

export function LlamaLockup() {
  return <Image src={image} alt="Llama Lockup" />;
}
