import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

export function MetaLockup() {
  return <Image src={image} alt="Meta Lockup" />;
}
