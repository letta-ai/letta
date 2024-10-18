import * as React from 'react';
import { Card } from '../../core/Card/Card';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';
import './ActionCard.scss';
import { ChevronRightIcon } from '../../icons';
import { Slot } from '@radix-ui/react-slot';

const actionCardVariants = cva('', {
  variants: {
    size: {
      default: '',
      medium: 'max-w-[300px]',
    },
    clickable: {
      true: 'cursor-pointer hover:bg-background-greyer',
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
  isActive?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  mainAction?: React.ReactNode;
  description?: string;
  children?: React.ReactNode;
  onCardClick?: () => void;
  actions?: React.ReactNode;
}

export function ActionCard(props: ToggleCardProps) {
  const {
    title,
    icon,
    badge,
    isActive,
    onCardClick,
    mainAction,
    children,
    description,
    actions,
  } = props;

  return (
    <Card
      onClick={onCardClick}
      className={cn(
        actionCardVariants({ ...props, clickable: !!onCardClick }),
        isActive ? 'bg-background-grey' : 'bg-background',
        'action-card'
      )}
    >
      <VStack fullHeight fullWidth>
        <HStack
          className="action-card-header"
          justify="spaceBetween"
          fullWidth
          align="center"
        >
          <VStack overflow="hidden" gap="text" fullWidth>
            <HStack fullWidth className="action-card-titlearea" align="center">
              {icon && <Slot className="w-5 h-5">{icon}</Slot>}
              <VStack gap={false} align="start">
                <HStack paddingRight fullWidth overflow="hidden">
                  <Typography noWrap fullWidth overflow="ellipsis" bold>
                    {title}
                  </Typography>
                </HStack>
                {props.subtitle && (
                  <Typography
                    fullWidth
                    overflow="ellipsis"
                    noWrap
                    variant="body2"
                    color="muted"
                  >
                    {props.subtitle}
                  </Typography>
                )}
              </VStack>
              {badge}
            </HStack>
          </VStack>
          {mainAction && <HStack align="center">{mainAction}</HStack>}
          {onCardClick && <ChevronRightIcon size="large" color="muted" />}
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
