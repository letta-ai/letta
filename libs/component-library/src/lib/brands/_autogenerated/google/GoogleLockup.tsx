import React from 'react';
import Image from 'next/image';
import image from './lockup.png';

interface GoogleLockupProps {
  width?: number;
  height?: number;
}

export function GoogleLockup(props: GoogleLockupProps) {
  return <Image src={image} alt="Google Logo" {...props} />;
}
