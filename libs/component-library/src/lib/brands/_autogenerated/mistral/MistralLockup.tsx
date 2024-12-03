import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface MistralLockupProps {
  width?: number;
  height?: number;
}

export function MistralLockup(props: MistralLockupProps) {
  return <Image src={image} alt="Mistral Logo" {...props} />;
}
