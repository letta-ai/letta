'use client';
import { useABTestId } from './hooks/useABTestId/useABTestId';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import {
  AbtestIcon,
  Button,
  CondensedDashboardPage,
  DotsVerticalIcon,
  HStack,
  LoadedTypography,
  LoadingEmptyStatusComponent,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import {
  CreateABTest,
  createAbTestMutationKey,
} from './_components/CreateABTest/CreateABTest';
import { useCurrentABTest } from './hooks/useCurrentABTest/useCurrentABTest';
import React from 'react';
import { ABTestActions } from './_components/ABTestActions/ABTestActions';
import { useIsMutating } from '@tanstack/react-query';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const abTestId = useABTestId();
  const t = useTranslations('projects/ab-tests/test');

  const { slug } = useCurrentProject();

  const isCreatingPage = useIsMutating({
    mutationKey: createAbTestMutationKey,
  });
  const { data } = useCurrentABTest();

  return (
    <CondensedDashboardPage
      title={[
        {
          preIcon: <AbtestIcon size="xsmall" />,
          label: t('root'),
          bold: true,
          href: `/projects/${slug}/ab-tests`,
        },
        ...(abTestId
          ? [
              {
                label: data?.body?.name || '',
                bold: true,
                contentOverride: (
                  <HStack align="center" paddingX="small">
                    {!data?.body?.name ? (
                      <HStack align="center" justify="center" gap="small">
                        <LoadedTypography
                          variant="body3"
                          fillerText="Hello there"
                        />
                        <Button
                          size="small"
                          preIcon={<DotsVerticalIcon />}
                          label={t('trigger')}
                          hideLabel
                          disabled
                          color="tertiary"
                          _use_rarely_className="opacity-0"
                        />
                      </HStack>
                    ) : (
                      <HStack align="center" justify="center" gap="small">
                        <Typography variant="body2">
                          {data.body.name}
                        </Typography>
                        <ABTestActions abTest={data.body} />
                      </HStack>
                    )}
                  </HStack>
                ),
              },
            ]
          : []),
      ]}
      subtitle={
        abTestId ? (
          <HStack paddingX="small" fullWidth justify="start">
            {!data?.body.description ? (
              <LoadedTypography
                variant="body3"
                fillerText="We are loading the description it is pretty long and we want to make sure it is displayed correctly."
              />
            ) : (
              <Typography variant="body3">
                {data.body.description || t('noDescription')}
              </Typography>
            )}
          </HStack>
        ) : null
      }
      actions={!abTestId ? <CreateABTest /> : null}
    >
      <VStack position="relative" fullWidth fullHeight>
        {isCreatingPage ? (
          <div className="absolute pageFadeIn border-l w-full h-full z-rightAboveZero bg-background-grey top-0 left-0">
            <VStack align="center" justify="center" fullWidth fullHeight>
              <LoadingEmptyStatusComponent isLoading />
            </VStack>
          </div>
        ) : null}
        {children}
      </VStack>
    </CondensedDashboardPage>
  );
}
