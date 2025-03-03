import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface ComposioLogoMarkProps {
  width?: number;
  height?: number;
}

export function ComposioLogoMark(props: ComposioLogoMarkProps) {
  return <Image src={image} alt="Composio LogoMark" {...props} />;
}
