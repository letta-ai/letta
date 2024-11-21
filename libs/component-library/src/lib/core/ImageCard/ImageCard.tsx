import * as React from 'react';
import type { StaticImport } from 'next/dist/shared/lib/get-img-props';
import { Card } from '../Card/Card';
import { VStack } from '../../framing/VStack/VStack';
import Image from 'next/image';
import { Typography } from '../Typography/Typography';
import { cn } from '@letta-web/core-style-config';
import { HStack } from '../../framing/HStack/HStack';

interface ImageCardProps {
  imageUrl: StaticImport | string;
  altText: string;
  title: string;
  description: string;
  className?: string;
  href?: string;
  onClick?: () => void;
  target?: string;
  badge?: React.ReactNode;
}

export function ImageCard(props: ImageCardProps) {
  const {
    imageUrl,
    className,
    altText,
    title,
    description,
    href,
    onClick,
    target,
    badge,
  } = props;

  const Component = href ? 'a' : 'button';

  return (
    <Component
      className="contents"
      href={href}
      onClick={onClick}
      target={target}
    >
      <Card className={cn('h-full hover:bg-tertiary-hover', className)}>
        <VStack align="start">
          <Image
            className="max-h-[87px] object-cover"
            src={imageUrl}
            alt={altText}
          />
          <Typography bold>{title}</Typography>
          <Typography>{description}</Typography>
        </VStack>
        {badge && (
          <HStack justify="end" className="mt-4">
            {badge}
          </HStack>
        )}
      </Card>
    </Component>
  );
}
