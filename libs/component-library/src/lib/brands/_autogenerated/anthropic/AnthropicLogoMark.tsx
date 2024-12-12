import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface AnthropicLogoMarkProps {
  width?: number;
  height?: number;
}

export function AnthropicLogoMark(props: AnthropicLogoMarkProps) {
  return <Image src={image} alt="Anthropic LogoMark" {...props} />;
}
