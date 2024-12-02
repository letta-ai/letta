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
  children?: React.ReactNode;
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
    children,
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
      <Card
        className={cn(
          'h-full flex flex-col hover:bg-tertiary-hover',
          className
        )}
      >
        <VStack fullHeight flex align="start">
          <Image
            className="max-h-[87px] object-cover bg-background-grey"
            src={imageUrl}
            alt={altText}
          />
          <Typography bold align="left">
            {title}
          </Typography>
          <Typography align="left">{description}</Typography>
        </VStack>
        <VStack align="start" justify="start" fullWidth>
          {children}
        </VStack>
        {badge && (
          <HStack justify="end" paddingTop>
            {badge}
          </HStack>
        )}
      </Card>
    </Component>
  );
}
