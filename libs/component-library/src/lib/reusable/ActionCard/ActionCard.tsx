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
import { forwardRef } from 'react';

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
  onClick?: () => void;
  hideClickArrow?: boolean;
  noMobileViewChange?: boolean;
  testId?: string;
  actions?: React.ReactNode;
}

export const ActionCard = forwardRef<HTMLElement, ToggleCardProps>(
  function ActionCard(props, ref) {
    const {
      title,
      icon,
      badge,
      testId,
      isActive,
      onClick,
      noMobileViewChange,
      hideClickArrow,
      mainAction,
      children,
      description,
      actions,
    } = props;

    return (
      <Card
        testId={testId}
        ref={ref}
        onClick={onClick}
        className={cn(
          actionCardVariants({ ...props, clickable: !!onClick }),
          isActive ? 'bg-background-grey' : 'bg-background',
          'action-card'
        )}
      >
        <VStack justify="start" fullHeight fullWidth>
          <HStack
            className="action-card-header"
            justify="spaceBetween"
            fullWidth
            align="center"
          >
            <VStack overflow="hidden" gap="text" fullWidth>
              <HStack
                fullWidth
                className={cn(noMobileViewChange ? '' : 'action-card-titlearea')}
                align="center"
              >
                {icon && <Slot className="w-5 h-5">{icon}</Slot>}
                <VStack gap={false} align="start">
                  <HStack paddingRight fullWidth overflow="hidden">
                    <Typography
                      align="left"
                      noWrap
                      fullWidth
                      overflow="ellipsis"
                      bold
                    >
                      {title}
                    </Typography>
                  </HStack>
                  {props.subtitle && (
                    <Typography
                      fullWidth
                      align="left"
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
            {onClick && !hideClickArrow && (
              <ChevronRightIcon size="large" color="muted" />
            )}
          </HStack>
          {description && (
            <VStack fullHeight>
              <Typography align="left" variant="body">
                {description}
              </Typography>
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
);
