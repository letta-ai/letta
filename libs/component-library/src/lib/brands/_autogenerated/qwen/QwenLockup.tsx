import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface QwenLockupProps {
  width?: number;
  height?: number;
}

export function QwenLockup(props: QwenLockupProps) {
  return <Image src={image} alt="Qwen Logo" {...props} />;
}
