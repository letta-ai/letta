import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface LmstudioLogoMarkProps {
  width?: number;
  height?: number;
}

export function LmstudioLogoMark(props: LmstudioLogoMarkProps) {
  return <Image src={image} alt="Lmstudio LogoMark" {...props} />;
}
