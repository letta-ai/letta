import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface LlamaLockupProps {
  width?: number;
  height?: number;
}

export function LlamaLockup(props: LlamaLockupProps) {
  return <Image src={image} alt="Llama Logo" {...props} />;
}
