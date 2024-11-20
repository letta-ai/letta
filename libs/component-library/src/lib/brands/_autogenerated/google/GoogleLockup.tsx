import React from 'react';
import Image from 'next/image';
import image from './lockup.png';

export function GoogleLockup() {
  return <Image src={image} alt="Google Lockup" />;
}
