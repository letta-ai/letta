import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { VStack } from '../../framing/VStack/VStack';
import { CloseIcon } from '../../icons';
import { Typography } from '../Typography/Typography';
import Image from 'next/image';
import type { StaticImport } from 'next/dist/shared/lib/get-img-props';
import { cn } from '@letta-web/core-style-config';

interface AdBannerProps {
  onClose?: {
    operation: () => void;
    text: string;
    icon?: React.ReactNode;
  };
  className?: string;
  textContentClassName?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  imageUrl: StaticImport | string;
  darkModeImage?: StaticImport | string;
}

export function AdBanner(props: AdBannerProps) {
  const {
    onClose,
    className,
    title,
    textContentClassName,
    description,
    action,
    imageUrl,
    darkModeImage,
  } = props;
  return (
    <HStack className={cn('w-full h-full', className)} position="relative">
      <VStack
        gap="large"
        className={textContentClassName}
        fullHeight
        justify="center"
        padding="xxlarge"
      >
        {onClose ? (
          <div className="absolute right-5 top-5 text-white">
            <button onClick={onClose.operation}>
              {onClose.icon || <CloseIcon size="large" />}
              <div className="sr-only">{onClose.text}</div>
            </button>
          </div>
        ) : null}
        <Typography variant="heading1" color="white" bold>
          {title}
        </Typography>
        <Typography color="white" variant="heading5">
          {description}
        </Typography>
        {action}
      </VStack>
      {darkModeImage ? (
        <>
          <Image
            className="visible-on-dark bg-background-black absolute object-cover h-full z-[-1]"
            src={darkModeImage}
            alt=""
          />
          <Image
            className="invisible-on-dark bg-background-black absolute object-cover h-full z-[-1]"
            src={imageUrl}
            alt=""
          />
        </>
      ) : (
        <Image
          className="absolute object-cover bg-background-black h-full z-[-1]"
          src={imageUrl}
          alt=""
        />
      )}
    </HStack>
  );
}
