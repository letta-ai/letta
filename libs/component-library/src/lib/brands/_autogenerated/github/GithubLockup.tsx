import React from 'react';
import Image from 'next/image';
import image from './lockup.svg';

interface GithubLockupProps {
  width?: number;
  height?: number;
}

export function GithubLockup(props: GithubLockupProps) {
  return <Image src={image} alt="Github Logo" {...props} />;
}
