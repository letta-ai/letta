import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface OllamaLockupProps {
  width?: number;
  height?: number;
}

export function OllamaLockup(props: OllamaLockupProps) {
  return <Image src={image} alt="Ollama Logo" {...props} />;
}
