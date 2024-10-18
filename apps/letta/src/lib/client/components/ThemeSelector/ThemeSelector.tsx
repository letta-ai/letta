import React, { useCallback, useEffect } from 'react';
import { useCurrentUser } from '$letta/client/hooks';
import {
  DarkModeIcon,
  LightModeIcon,
  RawToggleGroup,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useQueryClient } from '@tanstack/react-query';
import type { GetUser200ResponseType } from '$letta/web-api/user/userContracts';

export function ThemeSelector() {
  const t = useTranslations('components/ThemeSelector');
  const { theme } = useCurrentUser();
  const { mutate: updateCurrentUser } =
    webApi.user.updateCurrentUser.useMutation();
  const queryClient = useQueryClient();

  useEffect(() => {
    document.body.className = theme;
    document.body.dataset['mode'] = theme;
  }, [theme]);

  const handleThemeChange = useCallback(
    (nextTheme: string) => {
      queryClient.setQueriesData<GetUser200ResponseType | undefined>(
        {
          queryKey: webApiQueryKeys.user.getCurrentUser,
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            body: {
              ...oldData.body,
              theme: nextTheme,
            },
          };
        }
      );

      updateCurrentUser({
        body: {
          theme: nextTheme,
        },
      });
    },
    [queryClient, updateCurrentUser]
  );

  return (
    <RawToggleGroup
      hideLabel
      border
      onValueChange={(value) => {
        if (value) {
          handleThemeChange(value);
        }
      }}
      value={theme}
      label={t('label')}
      items={[
        {
          value: 'light',
          label: t('options.light'),
          icon: <LightModeIcon />,
          hideLabel: true,
        },
        {
          value: 'dark',
          label: t('options.dark'),
          icon: <DarkModeIcon />,
          hideLabel: true,
        },
      ]}
    />
  );
}
