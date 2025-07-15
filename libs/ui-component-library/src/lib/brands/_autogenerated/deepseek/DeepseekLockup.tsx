import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface DeepseekLockupProps {
  width?: number;
  height?: number;
}

export function DeepseekLockup(props: DeepseekLockupProps) {
  return <Image src={image} alt="Deepseek Logo" {...props} />;
}
