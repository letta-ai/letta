import * as React from 'react';
import type { StaticImport } from 'next/dist/shared/lib/get-img-props';
import { VStack } from '../../framing/VStack/VStack';
import Image from 'next/image';
import { Typography } from '../../core/Typography/Typography';
import { HStack } from '../../framing/HStack/HStack';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { DialogOverlay } from '../../core/Dialog/Dialog';
import { DialogTitle } from '@radix-ui/react-dialog';

interface OnboardingPrimaryHeadingProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
}

export function OnboardingPrimaryHeading(props: OnboardingPrimaryHeadingProps) {
  const { title, description, badge } = props;
  return (
    <VStack gap={false}>
      <HStack paddingBottom="small">{badge}</HStack>
      <VStack gap="small">
        <Typography variant="heading4">{title}</Typography>
        {description && (
          <Typography variant="heading6" color="lighter">
            {description}
          </Typography>
        )}
      </VStack>
    </VStack>
  );
}

interface OnboardingPrimaryDialogProps {
  imageUrl: StaticImport | string;
  title: string;
  children: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  isOpen?: boolean;
}

export function OnboardingPrimaryDialog(props: OnboardingPrimaryDialogProps) {
  const { imageUrl, title, children, isOpen, primaryAction, secondaryAction } =
    props;
  return (
    <DialogPrimitive.Root open={isOpen}>
      <DialogOverlay />
      <div className="fixed w-[100dvw] flex items-center top-0 left-0 justify-center h-[100dvh] z-dialog pointer-events-none">
        <DialogPrimitive.Content className="max-h-[100dvh] overflow-y-auto flex flex-col max-w-[468px] pointer-events-auto text-base  w-full bg-background gap-0   shadow-lg duration-200 ">
          <Image width={468} height={250} src={imageUrl} alt="" />
          <VStack gap="xlarge" padding color="background-grey">
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <VStack>{children}</VStack>
            {(secondaryAction || primaryAction) && (
              <HStack align="center" justify="spaceBetween">
                {secondaryAction || <div />}
                {primaryAction}
              </HStack>
            )}
          </VStack>
        </DialogPrimitive.Content>
      </div>
    </DialogPrimitive.Root>
  );
}
