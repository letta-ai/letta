import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface AnthropicLockupProps {
  width?: number;
  height?: number;
}

export function AnthropicLockup(props: AnthropicLockupProps) {
  return <Image src={image} alt="Anthropic Logo" {...props} />;
}
