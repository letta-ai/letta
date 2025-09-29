'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@letta-cloud/ui-styles';
import { useMemo } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';

const avatarVariants = cva('relative flex shrink-0 overflow-hidden text-sm', {
  variants: {
    size: {
      xxsmall: 'h-[16px] w-[16px] text-[10px]',
      xsmall: 'h-[18px] w-[18px] text-[10px]',
      small: 'h-biHeight-sm w-biWidth-sm',
      medium: 'h-[36px] w-[36px]',
      large: 'h-[40px] w-[40px] text-base',
      xlarge: 'h-[48px] w-[48px] text-base',
      xxlarge: 'h-[72px] w-[72px] text-[28px]',
    },
    framed: {
      true: '',
      false: '',
    },
  },
  defaultVariants: {
    size: 'medium',
    framed: false,
  },
  compoundVariants: [
    {
      size: 'medium',
      framed: true,
      className: 'border button-secondary-border p-[5px]',
    },
  ],
});

type AvatarVariantProps = VariantProps<typeof avatarVariants>;

type AvatarRootProps = AvatarVariantProps &
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>;

const AvatarRoot = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarRootProps
>(({ className, size, framed, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(avatarVariants({ size, framed }), className)}
    {...props}
  />
));
AvatarRoot.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn('aspect-square h-full w-full', className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center bg-muted',
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export interface AvatarProps extends AvatarVariantProps {
  imageSrc?: string;
  name: string;
}

function getBackgroundFromName(name: string) {
  const sum = name
    .split('')
    .map((char) => char.charCodeAt(0))
    .reduce((acc, val) => acc + val, 0);
  const hue = sum % 360;
  return `hsl(${hue}, 80%, 90%)`;
}

export function Avatar(props: AvatarProps) {
  const { imageSrc, size, framed, name = 'UU' } = props;

  const initials = useMemo(() => {
    const [firstName = '', lastName = ''] = (name || 'uu').split(' ');
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
  }, [name]);

  return (
    <AvatarRoot size={size} framed={framed}>
      <AvatarImage src={imageSrc} alt={name} />
      <AvatarFallback
        className="font-normal text-black"
        style={{ background: getBackgroundFromName(name) }}
      >
        {initials}
      </AvatarFallback>
    </AvatarRoot>
  );
}

interface IconAvatarProps extends AvatarVariantProps {
  icon: React.ReactNode;
  backgroundColor?: string;
  textColor?: string;
  className?: string;
}

export function IconAvatar(props: IconAvatarProps) {
  const { icon, textColor, size, backgroundColor, className } = props;

  return (
    <AvatarRoot size={size} className={className}>
      <AvatarFallback
        style={{
          color: textColor || 'var(--color-primary-content)',
          background: backgroundColor || 'var(--color-primary)',
        }}
      >
        {icon}
      </AvatarFallback>
    </AvatarRoot>
  );
}
