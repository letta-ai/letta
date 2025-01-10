import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface OllamaLogoMarkProps {
  width?: number;
  height?: number;
}

export function OllamaLogoMark(props: OllamaLogoMarkProps) {
  return <Image src={image} alt="Ollama LogoMark" {...props} />;
}
