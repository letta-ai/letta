import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

export function AnthropicLockup() {
  return <Image src={image} alt="Anthropic Lockup" />;
}
