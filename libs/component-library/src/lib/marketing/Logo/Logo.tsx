import * as React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';

const logoVariants = cva('', {
  variants: {
    color: {
      black: 'text-black',
      white: 'text-white',
      inherit: 'text-inherit',
    },
    size: {
      default: 'h-[24px] w-[24px]',
      large: 'h-[64px] w-[64px]',
    },
  },
  defaultVariants: {
    color: 'inherit',
    size: 'default',
  },
});

interface LogoBaseProps extends VariantProps<typeof logoVariants> {
  className?: string;
}

function LogoBase(props: LogoBaseProps) {
  const { color, size } = props;

  return (
    <svg
      className={cn(logoVariants({ color, size }))}
      width="364"
      height="364"
      viewBox="0 0 364 364"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M218.2 145.8H145.7V218.3H218.2V145.8Z" fill="currentColor" />
      <path
        d="M290.7 50.0999V0.699951H73.2V50.0999C73.2 62.8999 62.8999 73.2 50.0999 73.2H0.699951V290.7H50.0999C62.8999 290.7 73.2 301 73.2 313.8V363.2H290.7V313.8C290.7 301 301 290.7 313.8 290.7H363.2V73.2H313.8C301 73.2 290.7 62.8999 290.7 50.0999ZM290.7 267.6C290.7 280.4 280.4 290.7 267.6 290.7H96.2999C83.4999 290.7 73.2 280.4 73.2 267.6V96.2999C73.2 83.4999 83.4999 73.2 96.2999 73.2H267.6C280.4 73.2 290.7 83.4999 290.7 96.2999V267.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

interface LogoProps extends VariantProps<typeof logoVariants> {
  className?: string;
}

export function Logo(props: LogoProps) {
  const { className, size, color } = props;

  return (
    <div className={cn('contents', className)}>
      <LogoBase className={className} size={size} color={color} />
    </div>
  );
}
