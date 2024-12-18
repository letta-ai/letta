import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface GithubLogoMarkProps {
  width?: number;
  height?: number;
}

export function GithubLogoMark(props: GithubLogoMarkProps) {
  return <Image src={image} alt="Github LogoMark" {...props} />;
}
