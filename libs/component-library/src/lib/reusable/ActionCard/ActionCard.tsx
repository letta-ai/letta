import * as React from 'react';
import { Card } from '../../core/Card/Card';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';

interface ToggleCardProps {
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
    <Card>
      <VStack fullHeight fullWidth>
        <HStack justify="spaceBetween" fullWidth align="center">
          <VStack gap="text">
            <HStack align="center">
              {icon}
              <Typography bold>{title}</Typography>
            </HStack>
            {props.subtitle && (
              <Typography variant="body2" color="muted">
                {props.subtitle}
              </Typography>
            )}
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
          <HStack justify="spaceBetween" paddingTop="small">
            {actions}
          </HStack>
        )}
      </VStack>
    </Card>
  );
}
