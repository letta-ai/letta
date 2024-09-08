'use client';
import * as React from 'react';
import type { LogoBaseProps } from '../../marketing/Logo/Logo';
import { Logo } from '../../marketing/Logo/Logo';
import './LettaLoader.scss';
import { cn } from '@letta-web/core-style-config';
import { useEffect, useRef } from 'react';

interface LettaLoaderProps {
  size: LogoBaseProps['size'];
  color?: LogoBaseProps['color'];
  stopAnimation?: boolean;
}

export function LettaLoader(props: LettaLoaderProps) {
  const { size, color, stopAnimation } = props;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && stopAnimation) {
      const rotationMatrix = window.getComputedStyle(ref.current).transform;

      // return to 0 degrees
      // first set the rotation to the current rotation
      ref.current.style.transform = rotationMatrix;
      ref.current.style.animation = 'none';

      // then set it to 0
      setTimeout(() => {
        if (ref.current) {
          ref.current.style.transform = 'rotate(0deg)';
        }
      }, 100);
    }
  }, [stopAnimation]);

  return (
    <div
      ref={ref}
      className={cn('letta-loader', stopAnimation ? 'stop-loader' : '')}
    >
      <Logo size={size} color={color} />
    </div>
  );
}
