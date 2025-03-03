import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface GoogleLogoMarkProps {
  width?: number;
  height?: number;
}

export function GoogleLogoMark(props: GoogleLogoMarkProps) {
  return <Image src={image} alt="Google LogoMark" {...props} />;
}
