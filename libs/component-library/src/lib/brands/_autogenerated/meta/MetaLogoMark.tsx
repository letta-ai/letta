import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface MetaLogoMarkProps {
  width?: number;
  height?: number;
}

export function MetaLogoMark(props: MetaLogoMarkProps) {
  return <Image src={image} alt="Meta LogoMark" {...props} />;
}
