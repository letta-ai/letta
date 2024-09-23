import * as React from 'react';
import { Card } from '../../core/Card/Card';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';
import './ActionCard.scss';

const actionCardVariants = cva('', {
  variants: {
    size: {
      default: '',
      medium: 'max-w-[300px]',
    },
    fullWidthOnMobile: {
      true: '',
    },
  },
  compoundVariants: [
    {
      size: 'medium',
      fullWidthOnMobile: true,
      className: 'sm:max-w-[300px] max-w-[100%]',
    },
  ],
  defaultVariants: {
    size: 'default',
  },
});

interface ToggleCardProps extends VariantProps<typeof actionCardVariants> {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  mainAction?: React.ReactNode;
  description?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}

export function ActionCard(props: ToggleCardProps) {
  const { title, icon, mainAction, children, description, actions } = props;

  return (
    <Card className={cn(actionCardVariants(props), 'action-card')}>
      <VStack fullHeight fullWidth>
        <HStack
          wrap
          className="action-card-header"
          justify="spaceBetween"
          fullWidth
          align="center"
        >
          <VStack gap="text">
            <HStack className="action-card-titlearea" align="center">
              {icon}
              <VStack gap={false} align="start">
                <Typography bold>{title}</Typography>
                {props.subtitle && (
                  <Typography variant="body2" color="muted">
                    {props.subtitle}
                  </Typography>
                )}
              </VStack>
            </HStack>
          </VStack>
          <HStack align="center">{mainAction}</HStack>
        </HStack>
        {description && (
          <VStack fullHeight>
            <Typography variant="body">{description}</Typography>
          </VStack>
        )}
        {children}
        {actions && (
          <HStack justify="spaceBetween" paddingTop="large">
            {actions}
          </HStack>
        )}
      </VStack>
    </Card>
  );
}
