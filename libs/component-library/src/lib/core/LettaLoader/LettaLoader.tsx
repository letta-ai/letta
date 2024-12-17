'use client';
import * as React from 'react';
import type { LogoBaseProps } from '../../marketing/Logo/Logo';
import './LettaLoader.scss';
import './LettaGrowLoader.scss';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';
import { ErrorBoundary } from 'react-error-boundary';

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
  variant?: 'grower' | 'spinner';
}

export function LettaLoader(props: LettaLoaderProps) {
  const { variant = 'spinner', ...rest } = props;

  if (variant === 'spinner') {
    return <LettaSpinLoader {...rest} />;
  }

  return <LettaLoaderGrow {...rest} />;
}
