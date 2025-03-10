import * as React from 'react';
import type { StaticImport } from 'next/dist/shared/lib/get-img-props';
import { VStack } from '../../framing/VStack/VStack';
import Image from 'next/image';
import { Typography } from '../../core/Typography/Typography';
import { HStack } from '../../framing/HStack/HStack';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { DialogOverlay } from '../../core/Dialog/Dialog';

interface OnboardingPrimaryHeadingProps {
  title: React.ReactNode;
  description: React.ReactNode;
  badge?: React.ReactNode;
}

export function OnboardingPrimaryHeading(props: OnboardingPrimaryHeadingProps) {
  const { title, description, badge } = props;
  return (
    <VStack gap={false}>
      <HStack paddingBottom="small">{badge}</HStack>
      <Typography variant="heading4">{title}</Typography>
      <Typography variant="heading6" color="lighter">
        {description}
      </Typography>
    </VStack>
  );
}

interface OnboardingPrimaryDialogProps {
  imageUrl: StaticImport | string;
  children: React.ReactNode;
  primaryAction: React.ReactNode;
  secondaryAction: React.ReactNode;
  isOpen?: boolean;
}

export function OnboardingPrimaryDialog(props: OnboardingPrimaryDialogProps) {
  const { imageUrl, children, isOpen, primaryAction, secondaryAction } = props;
  return (
    <DialogPrimitive.Root open={isOpen}>
      <DialogOverlay />
      <DialogPrimitive.Content className="fixed flex flex-col max-w-[468px]  text-base left-[50%] top-[50%] z-dialog w-full bg-background gap-0 translate-x-[-50%] translate-y-[-50%] shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
        <Image width={468} height={250} src={imageUrl} alt="" />
        <VStack gap="xlarge" padding color="background-grey">
          <VStack>{children}</VStack>
          <HStack align="center" justify="spaceBetween">
            {secondaryAction || <div />}
            {primaryAction}
          </HStack>
        </VStack>
      </DialogPrimitive.Content>
    </DialogPrimitive.Root>
  );
}
