import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface BedrockLockupProps {
  width?: number;
  height?: number;
}

export function BedrockLockup(props: BedrockLockupProps) {
  return <Image src={image} alt="Bedrock Logo" {...props} />;
}
