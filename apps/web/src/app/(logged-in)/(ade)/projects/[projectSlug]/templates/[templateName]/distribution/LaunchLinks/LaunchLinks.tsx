import { useTranslations } from '@letta-cloud/translations';
import {
  Alert,
  Button,
  Form,
  FormField,
  FormProvider,
  HStack,
  isMultiValue,
  LoadingEmptyStatusComponent,
  LockClosedIcon,
  OfficesIcon,
  RawInput,
  RocketIcon,
  Select,
  Spinner,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  UpdateLaunchLinkSchema,
  type UpdateLaunchLinkType,
  webApi,
  webApiQueryKeys,
} from '@letta-cloud/sdk-web';
import type { webApiContracts } from '@letta-cloud/sdk-web';
import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';
import { useQueryClient } from '@tanstack/react-query';
import type { ServerInferResponses } from '@ts-rest/core';
import { getLaunchLinkUrl } from '@letta-cloud/utils-shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDebouncedValue } from '@mantine/hooks';

function NotCreatedLinkView() {
  const t = useTranslations('pages/distribution/LaunchLinks');
  const queryClient = useQueryClient();
  const { agentId: agentTemplateId } = useCurrentAgentMetaData();

  const { mutate, isPending, isError } =
    webApi.launchLinks.createLaunchLink.useMutation({
      onSuccess: (response) => {
        queryClient.setQueriesData<
          ServerInferResponses<typeof webApiContracts.launchLinks.getLaunchLink>
        >(
          {
            queryKey:
              webApiQueryKeys.launchLinks.getLaunchLink(agentTemplateId),
          },
          () => ({
            status: 200,
            body: response.body,
          }),
        );
      },
    });

  if (isPending) {
    return (
      <VStack
        color="background-grey"
        fullHeight
        justify="center"
        fullWidth
        align="center"
      >
        <LoadingEmptyStatusComponent
          isLoading
          loadingMessage={t('NotCreatedLinkView.creating')}
        />
      </VStack>
    );
  }

  return (
    <VStack padding="xlarge" border fullHeight fullWidth>
      <VStack width="contained" gap="form">
        <HStack>
          <RocketIcon size="large" />
          <Typography variant="heading4" bold>
            {t('NotCreatedLinkView.title')}
          </Typography>
        </HStack>
        {isError && (
          <Alert title={t('NotCreatedLinkView.error')} variant="destructive" />
        )}

        <Typography>{t('NotCreatedLinkView.description')}</Typography>

        <div>
          <Button
            onClick={() => {
              mutate({
                params: {
                  agentTemplateId,
                },
              });
            }}
            size="large"
            label={t('NotCreatedLinkView.cta')}
            color="primary"
          />
        </div>
        <Alert variant="info" title={t('NotCreatedLinkView.info')} />
      </VStack>
    </VStack>
  );
}

interface LaunchLinkConfigurationProps {
  defaultAccessLevel: UpdateLaunchLinkType['accessLevel'];
}

function LaunchLinkConfiguration(props: LaunchLinkConfigurationProps) {
  const { defaultAccessLevel } = props;
  const form = useForm<UpdateLaunchLinkType>({
    resolver: zodResolver(UpdateLaunchLinkSchema),
    defaultValues: {
      accessLevel: defaultAccessLevel,
    },
  });

  const t = useTranslations('pages/distribution/LaunchLinks');
  const queryClient = useQueryClient();

  const { agentId: agentTemplateId } = useCurrentAgentMetaData();
  const { mutate, isPending, isError } =
    webApi.launchLinks.updateLaunchLink.useMutation({
      onSuccess: (response) => {
        queryClient.setQueriesData<
          ServerInferResponses<typeof webApiContracts.launchLinks.getLaunchLink>
        >(
          {
            queryKey:
              webApiQueryKeys.launchLinks.getLaunchLink(agentTemplateId),
          },
          () => response,
        );
      },
    });

  const options = useMemo(() => {
    return [
      {
        label: t('LaunchLinkConfiguration.accessLevel.organization'),
        value: 'organization',
        icon: <OfficesIcon />,
      },
      {
        label: t('LaunchLinkConfiguration.accessLevel.logged-in'),
        value: 'logged-in',
        icon: <LockClosedIcon />,
      },
    ];
  }, [t]);

  const handleSubmit = useCallback(
    (data: UpdateLaunchLinkType) => {
      mutate({
        params: {
          agentTemplateId,
        },
        body: data,
      });
    },
    [mutate, agentTemplateId],
  );

  const getOption = useCallback(
    (value: string) => {
      return options.find((option) => option.value === value);
    },
    [options],
  );

  const [debouncedDirty] = useDebouncedValue(form.formState.isDirty, 1000);

  useEffect(() => {
    handleSubmit(form.getValues());
  }, [debouncedDirty, form, handleSubmit]);

  return (
    <FormProvider {...form}>
      <Form>
        <VStack gap="form">
          {isError && (
            <Alert
              title={t('LaunchLinkConfiguration.error')}
              variant="destructive"
            />
          )}
          <FormField
            name="accessLevel"
            render={({ field }) => (
              <Select
                fullWidth
                rightOfLabelContent={
                  isPending ? <Spinner size="xsmall" /> : null
                }
                label={t('LaunchLinkConfiguration.accessLevel.label')}
                options={options}
                onSelect={(option) => {
                  if (isMultiValue(option) || !option) {
                    return;
                  }

                  field.onChange(option.value);
                }}
                value={getOption(field.value)}
              />
            )}
          />
        </VStack>
      </Form>
    </FormProvider>
  );
}

export function LaunchLinks() {
  const { agentId } = useCurrentAgentMetaData();
  const { data: launchLinkConfig } = webApi.launchLinks.getLaunchLink.useQuery({
    queryKey: webApiQueryKeys.launchLinks.getLaunchLink(agentId),
    queryData: {
      params: {
        agentTemplateId: agentId,
      },
    },
  });

  const t = useTranslations('pages/distribution/LaunchLinks');

  if (!launchLinkConfig) {
    return <LoadingEmptyStatusComponent isLoading />;
  }

  if (!launchLinkConfig.body?.accessLevel) {
    return <NotCreatedLinkView />;
  }

  return (
    <VStack fullHeight border overflow="hidden" fullWidth>
      <VStack padding fullHeight width="contained" gap="large">
        <VStack>
          <Typography align="left" bold variant="heading6">
            <RocketIcon /> {t('title')}
          </Typography>
          <Typography align="left">{t('description')}</Typography>
        </VStack>
        <VStack gap="form">
          <LaunchLinkConfiguration
            defaultAccessLevel={launchLinkConfig.body.accessLevel}
          />
          <RawInput
            label={t('link.label')}
            value={getLaunchLinkUrl(launchLinkConfig.body.launchLink)}
            fullWidth
            color="default"
            readOnly
            allowCopy
          />
        </VStack>
      </VStack>
    </VStack>
  );
}
