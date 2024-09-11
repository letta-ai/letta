'use client';
import React from 'react';
import {
  Avatar,
  Button,
  HStack,
  Typography,
  VStack,
} from '@letta-web/component-library';
import { useCurrentUser } from '$letta/client/hooks';
import { webApi, webApiQueryKeys } from '$letta/client';

export function CurrentUserDetailsBlock() {
  const { name } = useCurrentUser();
  const { data } = webApi.organizations.getCurrentOrganization.useQuery({
    queryKey: webApiQueryKeys.organizations.getCurrentOrganization,
  });

  return (
    <HStack padding="large" align="center">
      <Avatar name={name} />
      <VStack gap={false} fullWidth align="start">
        <Typography bold>{name}</Typography>
        {data && (
          <Typography variant="body2" color="muted">
            {data.body.name}
          </Typography>
        )}
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
