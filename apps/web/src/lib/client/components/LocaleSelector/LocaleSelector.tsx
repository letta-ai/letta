import React, { useCallback } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuItem,
  LanguageSwitcherIcon,
} from '@letta-web/component-library';
import { useTranslations } from '@letta-cloud/translations';
import { webApi, webApiQueryKeys } from '$web/client';
import { useQueryClient } from '@tanstack/react-query';
import type { ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/web-api-client';

export function LocaleSelector() {
  const t = useTranslations('components/LocaleSelector');
  const { mutate: updateCurrentUser } =
    webApi.user.updateCurrentUser.useMutation({
      onSuccess: () => {
        window.location.reload();
      },
    });
  const queryClient = useQueryClient();

  const handleLocaleChange = useCallback(
    (nextLocale: string) => {
      queryClient.setQueriesData<
        | ServerInferResponses<typeof contracts.user.getCurrentUser, 200>
        | undefined
      >(
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
              locale: nextLocale,
            },
          };
        },
      );

      updateCurrentUser({
        body: {
          locale: nextLocale,
        },
      });
    },
    [queryClient, updateCurrentUser],
  );

  return (
    <DropdownMenu
      align="start"
      triggerAsChild
      trigger={
        <Button
          color="tertiary"
          hideLabel
          preIcon={<LanguageSwitcherIcon />}
          label={t('changeLocale')}
        />
      }
    >
      <DropdownMenuItem
        label="English"
        onClick={() => {
          handleLocaleChange('en');
        }}
      />
      <DropdownMenuItem
        label="Français (BETA)"
        onClick={() => {
          handleLocaleChange('fr');
        }}
      />
    </DropdownMenu>
  );
}
