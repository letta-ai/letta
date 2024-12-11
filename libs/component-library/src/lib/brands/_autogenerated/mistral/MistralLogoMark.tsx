import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface MistralLogoMarkProps {
  width?: number;
  height?: number;
}

export function MistralLogoMark(props: MistralLogoMarkProps) {
  return <Image src={image} alt="Mistral LogoMark" {...props} />;
}
