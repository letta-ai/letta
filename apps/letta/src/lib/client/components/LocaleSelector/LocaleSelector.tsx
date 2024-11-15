import React, { useCallback } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuItem,
  LanguageSwitcherIcon,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useQueryClient } from '@tanstack/react-query';
import type { GetUser200ResponseType } from '$letta/web-api/user/userContracts';

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
              locale: nextLocale,
            },
          };
        }
      );

      updateCurrentUser({
        body: {
          locale: nextLocale,
        },
      });
    },
    [queryClient, updateCurrentUser]
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
        label={t('options.en')}
        onClick={() => {
          handleLocaleChange('en');
        }}
      />
      <DropdownMenuItem
        label={t('options.fr')}
        onClick={() => {
          handleLocaleChange('fr');
        }}
      />
    </DropdownMenu>
  );
}
