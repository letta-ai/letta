'use client';

import React from 'react';
import {
  DiscordLogoMarkDynamic,
} from '@letta-cloud/ui-component-library';
import { HiddenOnMobile } from '@letta-cloud/ui-component-library';
import {
  Button,
  HStack,
  Popover,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { show as startIntercom } from '@intercom/messenger-js-sdk';

function ShowIntercom() {
  const t = useTranslations(
    'components/DashboardLikeLayout/DashboardNavigation',
  );

  return (
    <Button
      label={t('DashboardHeaderNavigation.supportPopover.bugReport.start')}
      onClick={startIntercom}
      color="secondary"
      align="center"
      fullWidth
    />
  );
}

interface DashboardHeaderNavigationProps {
  preItems?: React.ReactNode;
}

export function DashboardHeaderNavigation(
  props: DashboardHeaderNavigationProps,
) {
  const { preItems } = props;
  const t = useTranslations(
    'components/DashboardLikeLayout/DashboardNavigation',
  );

  return (
    <HiddenOnMobile>
      <HStack gap="small" align="center">
        {preItems}
        <Popover
          triggerAsChild
          trigger={
            <Button
              size="xsmall"
              color="tertiary"
              label={t('DashboardHeaderNavigation.support')}
            />
          }
        >
          <VStack gap="large" borderBottom padding>
            <Typography variant="heading5">
              {t('DashboardHeaderNavigation.supportPopover.bugReport.title')}
            </Typography>
            <Typography>
              {t(
                'DashboardHeaderNavigation.supportPopover.bugReport.description',
              )}
            </Typography>
            <ShowIntercom />
          </VStack>
          <VStack gap="large" borderBottom padding>
            <Typography variant="heading5">
              {t('DashboardHeaderNavigation.supportPopover.discord.title')}
            </Typography>
            <Typography>
              {t(
                'DashboardHeaderNavigation.supportPopover.discord.description',
              )}
            </Typography>
            <a
              target="_blank"
              rel="noreferrer"
              className="px-3 flex justify-center items-center gap-2 py-2 text-white bg-[#7289da]"
              href="https://discord.gg/letta"
            >
              { }
              <DiscordLogoMarkDynamic size="small" />
              <Typography bold>
                {t('DashboardHeaderNavigation.supportPopover.discord.joinUs')}
              </Typography>
            </a>
          </VStack>
        </Popover>
        <Button
          size="xsmall"
          color="tertiary"
          target="_blank"
          label={t('DashboardHeaderNavigation.documentation')}
          href="https://docs.letta.com/introduction"
        />
        <Button
          size="xsmall"
          color="tertiary"
          target="_blank"
          label={t('DashboardHeaderNavigation.apiReference')}
          href="https://docs.letta.com/api-reference"
        />
      </HStack>
    </HiddenOnMobile>
  );
}
