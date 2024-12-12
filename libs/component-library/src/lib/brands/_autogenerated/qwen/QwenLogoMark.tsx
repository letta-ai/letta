import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface QwenLogoMarkProps {
  width?: number;
  height?: number;
}

export function QwenLogoMark(props: QwenLogoMarkProps) {
  return <Image src={image} alt="Qwen LogoMark" {...props} />;
}
