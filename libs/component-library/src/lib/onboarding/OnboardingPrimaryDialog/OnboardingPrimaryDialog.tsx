import * as React from 'react';
import type { StaticImport } from 'next/dist/shared/lib/get-img-props';
import { VStack } from '../../framing/VStack/VStack';
import Image from 'next/image';
import { Typography } from '../../core/Typography/Typography';
import { HStack } from '../../framing/HStack/HStack';

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
}

export function OnboardingPrimaryDialog(props: OnboardingPrimaryDialogProps) {
  const { imageUrl, children, primaryAction, secondaryAction } = props;
  return (
    <VStack gap={false} className="max-w-[468px]" fullWidth>
      <Image width={468} height={250} src={imageUrl} alt="" />
      <VStack gap="xlarge" padding color="background-grey">
        <VStack>{children}</VStack>
        <HStack align="center" justify="spaceBetween">
          {secondaryAction || <div />}
          {primaryAction}
        </HStack>
      </VStack>
    </VStack>
  );
}
