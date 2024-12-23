'use client';
import React from 'react';
import {
  Avatar,
  Button,
  HStack,
  Typography,
  VStack,
} from '@letta-web/component-library';
import { webApi, webApiQueryKeys } from '$web/client';

interface CurrentUserDetailsBlockProps {
  hideSettingsButton?: boolean;
}

export function CurrentUserDetailsBlock(props: CurrentUserDetailsBlockProps) {
  const { hideSettingsButton } = props;
  const { data: user } = webApi.user.getCurrentUser.useQuery({
    queryKey: webApiQueryKeys.user.getCurrentUser,
  });
  const { data } = webApi.organizations.getCurrentOrganization.useQuery({
    queryKey: webApiQueryKeys.organizations.getCurrentOrganization,
  });

  return (
    <HStack padding="large" align="center">
      <Avatar name={user?.body.name || ''} />
      <VStack gap={false} fullWidth align="start">
        <Typography bold>{user?.body.name}</Typography>
        {data && (
          <Typography variant="body2" color="muted">
            {data.body.name}
          </Typography>
        )}
      </VStack>
      {!hideSettingsButton && (
        <Button
          size="small"
          target="_blank"
          href="/settings"
          color="tertiary"
          label="Settings"
        />
      )}
    </HStack>
  );
}
