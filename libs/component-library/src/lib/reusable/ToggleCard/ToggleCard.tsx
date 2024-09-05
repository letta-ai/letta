import * as React from 'react';
import { Card } from '../../core/Card/Card';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import { RawToggle } from '../../core/Toggle/Toggle';

interface ToggleCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  actions?: React.ReactNode;
}

export function ToggleCard(props: ToggleCardProps) {
  const { title, icon, checked, onChange, description, actions } = props;

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
          <HStack align="center">
            <RawToggle
              label={`Toggle ${title}`}
              hideLabel
              checked={checked}
              onClick={() => {
                onChange(!checked);
              }}
            />
          </HStack>
        </HStack>
        {description && (
          <VStack fullHeight>
            <Typography variant="body">{description}</Typography>
          </VStack>
        )}
        {actions && (
          <HStack justify="spaceBetween" paddingTop="small">
            {actions}
          </HStack>
        )}
      </VStack>
    </Card>
  );
}
