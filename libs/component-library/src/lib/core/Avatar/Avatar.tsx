'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@letta-web/core-style-config';
import { useMemo } from 'react';

const AvatarRoot = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      'relative flex h-[32px] w-[32px] shrink-0 overflow-hidden text-sm rounded-md',
      className
    )}
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
      'flex h-full w-full items-center justify-center rounded-sm bg-muted',
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

interface AvatarProps {
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
  const { imageSrc, name = 'UU' } = props;

  const initials = useMemo(() => {
    const [firstName = '', lastName = ''] = (name || 'uu').split(' ');
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
  }, [name]);

  return (
    <AvatarRoot>
      <AvatarImage src={imageSrc} alt={name} />
      <AvatarFallback
        className="font-normal"
        style={{ background: getBackgroundFromName(name) }}
      >
        {initials}
      </AvatarFallback>
    </AvatarRoot>
  );
}
