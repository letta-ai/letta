import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface NvidiaLogoMarkProps {
  width?: number;
  height?: number;
}

export function NvidiaLogoMark(props: NvidiaLogoMarkProps) {
  return <Image src={image} alt="Nvidia LogoMark" {...props} />;
}
