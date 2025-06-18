import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface BedrockLogoMarkProps {
  width?: number;
  height?: number;
}

export function BedrockLogoMark(props: BedrockLogoMarkProps) {
  return <Image src={image} alt="Bedrock LogoMark" {...props} />;
}
