import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface AzureLockupProps {
  width?: number;
  height?: number;
}

export function AzureLockup(props: AzureLockupProps) {
  return <Image src={image} alt="Azure Logo" {...props} />;
}
