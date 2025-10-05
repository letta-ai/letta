import React, { useCallback, useEffect } from 'react';
import { useCurrentUser } from '$web/client/hooks';
import {
  AutoThemeIcon,
  DarkModeIcon,
  // EmoticonIcon,
  LightModeIcon,
  RawToggleGroup,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { webApi, webApiQueryKeys } from '$web/client';
import { useQueryClient } from '@tanstack/react-query';
import type { ServerInferResponses } from '@ts-rest/core';
import type { contracts } from '@letta-cloud/sdk-web';

export function ThemeSelector() {
  const t = useTranslations('components/ThemeSelector');
  const user = useCurrentUser();
  const { mutate: updateCurrentUser } =
    webApi.user.updateCurrentUser.useMutation();
  const queryClient = useQueryClient();

  const theme = user?.theme || 'auto';

  useEffect(() => {
    const root = document.documentElement;
    // Preserve existing classes (e.g., font and layout) and only manage theme classes/data-attr
    root.dataset['mode'] = theme || 'auto';

    // Toggle only the 'dark' class explicitly; Tailwind also respects [data-mode="dark"]
    root.classList.remove('dark');
    if (theme === 'dark') {
      root.classList.add('dark');
    }
  }, [theme]);

  const handleThemeChange = useCallback(
    (nextTheme: string) => {
      // Apply immediately on client and persist to localStorage for no-flash reloads
      try {
        localStorage.setItem('theme', nextTheme);
        const root = document.documentElement;
        root.dataset['mode'] = nextTheme || 'auto';
        root.classList.remove('dark');
        if (
          nextTheme === 'dark' ||
          (nextTheme === 'auto' &&
            window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: dark)').matches)
        ) {
          root.classList.add('dark');
        }
      } catch (_e) {}

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
              theme: nextTheme,
            },
          };
        },
      );

      updateCurrentUser(
        {
          body: {
            theme: nextTheme,
          },
        },
        {
          onSuccess: () => {
            const faviconHref = document.getElementById('favicon');

            if (faviconHref) {
              (faviconHref as HTMLAnchorElement).href =
                `/icon?theme=${nextTheme}`;
            }
          },
        },
      );
    },
    [queryClient, updateCurrentUser],
  );

  return (
    <RawToggleGroup
      hideLabel
      color="background"
      border
      padding="xxsmall"
      /* eslint-disable-next-line react/forbid-component-props */
      className="theme-selector-border"
      onValueChange={(value) => {
        if (value) {
          handleThemeChange(value);
        }
      }}
      value={theme}
      label={t('label')}
      items={[
        {
          value: 'auto',
          label: t('options.auto'),
          icon: <AutoThemeIcon />,
          hideLabel: true,
        },
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
        // {
        //   value: 'hacker',
        //   label: t('options.hacker'),
        //   icon: <EmoticonIcon />,
        //   hideLabel: true,
        // },
      ]}
    />
  );
}
