import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface LettaLogoMarkProps {
  width?: number;
  height?: number;
}

export function LettaLogoMark(props: LettaLogoMarkProps) {
  return <Image src={image} alt="Letta LogoMark" {...props} />;
}
