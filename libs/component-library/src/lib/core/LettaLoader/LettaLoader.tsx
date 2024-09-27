'use client';
import * as React from 'react';
import type { LogoBaseProps } from '../../marketing/Logo/Logo';
import { LogoBaseInner, LogoBaseOuter } from '../../marketing/Logo/Logo';
import './LettaLoader.scss';
import { cn } from '@letta-web/core-style-config';
import { useEffect, useRef } from 'react';

interface LettaLoaderProps {
  size: LogoBaseProps['size'];
  color?: LogoBaseProps['color'];
  stopAnimation?: boolean;
  id?: string;
}

export function LettaLoader(props: LettaLoaderProps) {
  const { size, id, color, stopAnimation } = props;
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
    <div className="relative" id={id}>
      <div
        ref={ref}
        className={cn('letta-loader ', stopAnimation ? 'stop-loader' : '')}
      >
        <LogoBaseOuter
          className="absolute top-0 left-0"
          size={size}
          color={color}
        />
      </div>
      <LogoBaseInner className="absolute top-0" size={size} color={color} />
    </div>
  );
}
