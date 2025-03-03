import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface LlamaLogoMarkProps {
  width?: number;
  height?: number;
}

export function LlamaLogoMark(props: LlamaLogoMarkProps) {
  return <Image src={image} alt="Llama LogoMark" {...props} />;
}
