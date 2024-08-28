import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@letta-web/core-style-config';

const buttonVariants = cva('px-6 py-3 cursor-pointer inline-flex gap-2', {
  variants: {
    variant: {
      primaryLight: 'bg-white text-black',
      primaryDark: 'bg-black text-white',
      secondaryDark: 'bg-transparent text-black border-black border',
      secondaryLight: 'bg-transparent text-white border ',
    },
  },
  defaultVariants: {
    variant: 'primaryLight',
  },
});

export type MarketingButtonProps = React.HTMLAttributes<
  HTMLAnchorElement | HTMLButtonElement
> &
  VariantProps<typeof buttonVariants> & {
    href?: string;
    target?: string;
    label?: string;
    preIcon?: React.ReactNode;
  };

export function MarketingButton({
  className,
  preIcon,
  variant,
  href,
  target,
  label,
  ...props
}: MarketingButtonProps) {
  if (href) {
    return (
      <a
        href={href}
        className={cn(buttonVariants({ variant, className }))}
        target={target}
        {...props}
      >
        {preIcon}
        {label}
      </a>
    );
  }

  return (
    <button className={cn(buttonVariants({ variant, className }))} {...props}>
      {preIcon}
      {label}
    </button>
  );
}
