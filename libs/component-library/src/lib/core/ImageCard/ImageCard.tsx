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
  variant?: 'default' | 'inline';
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
    variant,
    title,
    description,
    href,
    onClick,
    target,
    children,
    badge,
  } = props;

  const Component = href ? 'a' : 'button';

  if (variant === 'inline') {
    return (
      <Component
        href={href}
        data-testid={`image-card:${title}`}
        onClick={onClick}
        type="button"
        target={target}
      >
        <Card
          className={cn(
            'h-full flex flex-row gap-2 hover:bg-tertiary-hover',
            className
          )}
        >
          <Image
            className="max-h-[72px] max-w-[72px] object-cover bg-background-grey"
            src={imageUrl}
            alt={altText}
          />
          <VStack>
            <VStack gap={false} fullHeight flex align="start">
              <Typography bold align="left">
                {title}
              </Typography>
              <Typography className="line-clamp-2" align="left">
                {description}
              </Typography>
            </VStack>
            <VStack align="start" justify="start" fullWidth>
              {children}
            </VStack>
            {badge && <HStack justify="end">{badge}</HStack>}
          </VStack>
        </Card>
      </Component>
    );
  }

  return (
    <Component
      href={href}
      data-testid={`image-card:${title}`}
      onClick={onClick}
      type="button"
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
