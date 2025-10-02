'use client';
import * as React from 'react';
import type { LogoBaseProps } from '../../marketing/Logo/Logo';
import { LogoBaseInner, LogoBaseOuter } from '../../marketing/Logo/Logo';
import './LettaLoader.scss';
import './LettaGrowLoader.scss';
import './LettaFlipLoader.scss';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '@letta-cloud/ui-styles';
import { useEffect, useRef } from 'react';
import { LettaSpinnerInner, LettaSpinnerOuter } from './LettaSpinner';
import Lottie from 'react-lottie';
import darkLogo from './_logo/dark-sygnetrotate.json';
import lightLogo from './_logo/light-sygnetrotate.json';

function LettaFlipLoader(props: LettaLoaderProps) {
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

const loaderVariants = cva('', {
  variants: {
    size: {
      small: 'w-[16px]',
      medium: 'w-[20px]',
      big: 'w-[36px]',
      default: 'w-[64px]',
      large: 'w-[96px]',
      xlarge: 'w-[256px]',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

interface LettaLoaderBaseProps extends VariantProps<typeof loaderVariants> {
  color?: LogoBaseProps['color'];
  stopAnimation?: boolean;
  id?: string;
  fillColor?: string;
}

function LettaSpinLoader(props: LettaLoaderBaseProps) {
  const { id, size, fillColor, stopAnimation } = props;

  return (
    <div
      className={cn('relative overflow-hidden', loaderVariants({ size }))}
      id={id}
    >
      <div
        className={cn(
          'absolute top-[0px] w-full',
          !stopAnimation ? 'fadeInAnUp' : '',
        )}
      >
        <LettaSpinnerOuter fillColor={fillColor} />
      </div>
      <div className={cn('absolute w-full flex items-center')}>
        <LettaSpinnerInner fillColor={fillColor} />
      </div>
      <div className="opacity-0 mb-[10%]">
        <LettaSpinnerOuter fillColor={fillColor} />
      </div>
    </div>
  );
}

function LettaSpinLoader3d(props: LettaLoaderBaseProps) {
  const { id, size } = props;

  const logoOptions = {
    loop: true,
    autoplay: true,
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid slice',
    },
  };

  return (
    <div id={id} className={loaderVariants({ size })}>
      <div className="visible-on-dark">
        <Lottie
          options={{
            ...logoOptions,
            animationData: lightLogo,
          }}
          isClickToPauseDisabled={true}
        />
      </div>
      <div className="invisible-on-dark">
        <Lottie
          options={{
            ...logoOptions,
            animationData: darkLogo,
          }}
          isClickToPauseDisabled={true}
        />
      </div>
    </div>
  );
}

function LettaLoaderGrow(props: LettaLoaderBaseProps) {
  const { id } = props;

  return (
    <div className="letta-loader-grow-wrapper" id={id}>
      <div className="letta-loader-grow-wrapper-item"></div>
    </div>
  );
}

export interface LettaLoaderProps extends LettaLoaderBaseProps {
  variant?: 'flipper' | 'grower' | 'spinner' | 'spinner3d';
}

export function LettaLoader(props: LettaLoaderProps) {
  const { variant = 'spinner', ...rest } = props;

  if (variant === 'flipper') {
    return <LettaFlipLoader {...rest} />;
  }

  if (variant === 'spinner') {
    return <LettaSpinLoader {...rest} />;
  }

  if (variant === 'spinner3d') {
    return <LettaSpinLoader3d {...rest} />;
  }

  return <LettaLoaderGrow {...rest} />;
}
