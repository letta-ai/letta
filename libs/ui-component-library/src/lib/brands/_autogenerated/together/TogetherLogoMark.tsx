import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface TogetherLogoMarkProps {
  width?: number;
  height?: number;
}

export function TogetherLogoMark(props: TogetherLogoMarkProps) {
  return <Image src={image} alt="Together LogoMark" {...props} />;
}
