import React from 'react';
import Image from 'next/image';
import image from './logomark.svg';

interface NousResearchLogoMarkProps {
  width?: number;
  height?: number;
}

export function NousResearchLogoMark(props: NousResearchLogoMarkProps) {
  return <Image src={image} alt="NousResearch LogoMark" {...props} />;
}
