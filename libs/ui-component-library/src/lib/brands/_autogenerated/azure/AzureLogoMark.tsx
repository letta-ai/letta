import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface AzureLogoMarkProps {
  width?: number;
  height?: number;
}

export function AzureLogoMark(props: AzureLogoMarkProps) {
  return <Image src={image} alt="Azure LogoMark" {...props} />;
}
