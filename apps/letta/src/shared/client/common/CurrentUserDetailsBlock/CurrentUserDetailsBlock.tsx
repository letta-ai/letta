import React from 'react';
import {
  Avatar,
  Button,
  HStack,
  Typography,
  VStack,
} from '@letta-web/component-library';
import { useCurrentUser } from '$letta/client/hooks';

export function CurrentUserDetailsBlock() {
  const { name } = useCurrentUser();

  return (
    <HStack padding="small" align="center">
      <Avatar name={name} />
      <VStack gap={false} fullWidth align="start">
        <Typography bold>{name}</Typography>
        <Typography variant="body2" color="muted">
          Developer
        </Typography>
      </VStack>
      <Button
        size="small"
        target="_blank"
        href="/settings"
        color="tertiary"
        label="Settings"
      />
    </HStack>
  );
}
