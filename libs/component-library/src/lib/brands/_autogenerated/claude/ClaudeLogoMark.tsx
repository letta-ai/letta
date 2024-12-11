import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface ClaudeLogoMarkProps {
  width?: number;
  height?: number;
}

export function ClaudeLogoMark(props: ClaudeLogoMarkProps) {
  return <Image src={image} alt="Claude LogoMark" {...props} />;
}
