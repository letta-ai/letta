import React from 'react';
import Image from 'next/image';
import image from './lockup.png';

interface NousResearchLockupProps {
  width?: number;
  height?: number;
}

export function NousResearchLockup(props: NousResearchLockupProps) {
  return <Image src={image} alt="NousResearch Logo" {...props} />;
}
