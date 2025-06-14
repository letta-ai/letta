import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface ZapierLogoMarkProps {
  width?: number;
  height?: number;
}

export function ZapierLogoMark(props: ZapierLogoMarkProps) {
  return <Image src={image} alt="Zapier LogoMark" {...props} />;
}
