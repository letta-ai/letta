'use client';
import * as React from 'react';
import type { LogoBaseProps } from '../../marketing/Logo/Logo';
import { LogoBaseInner, LogoBaseOuter } from '../../marketing/Logo/Logo';
import './LettaLoader.scss';
import './LettaGrowLoader.scss';
import './LettaFlipLoader.scss';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';
import { ErrorBoundary } from 'react-error-boundary';
import { useEffect, useRef } from 'react';

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
      default: 'w-[24px]',
      large: 'w-[128px]',
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
}

function LettaSpinLoader(props: LettaLoaderBaseProps) {
  const { id, size, stopAnimation } = props;

  return (
    <div className={cn('relative', loaderVariants({ size }))} id={id}>
      <ErrorBoundary fallback={<LettaLoaderGrow {...props} />}>
        <div className="absolute top-0 opacity-100-on-dark w-full">
          <DotLottieReact
            width={256}
            src="/animations/loader-dark.lottie"
            loop={!stopAnimation}
            autoplay
          />
        </div>
        <div className="opacity-0-on-dark w-full">
          <DotLottieReact
            width={256}
            src="/animations/loader.lottie"
            loop={!stopAnimation}
            autoplay
          />
        </div>
      </ErrorBoundary>
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
  variant?: 'flipper' | 'grower' | 'spinner';
}

export function LettaLoader(props: LettaLoaderProps) {
  const { variant = 'spinner', ...rest } = props;

  if (variant === 'flipper') {
    return <LettaFlipLoader {...rest} />;
  }

  if (variant === 'spinner') {
    return <LettaSpinLoader {...rest} />;
  }

  return <LettaLoaderGrow {...rest} />;
}
