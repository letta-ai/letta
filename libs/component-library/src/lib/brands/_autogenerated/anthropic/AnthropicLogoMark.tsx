import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

export function AnthropicLogoMark() {
  return <Image src={image} alt="Anthropic LogoMark" />;
}
