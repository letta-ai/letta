import React, { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useQueryClient } from '@tanstack/react-query';
import { webApi, webApiQueryKeys } from '@letta-cloud/web-api-client';
import type {
  AccessLevelEnumSchemaType,
  webApiContracts,
} from '@letta-cloud/web-api-client';
import type { ServerInferResponses } from '@ts-rest/core';
import {
  Button,
  CompanyIcon,
  Dialog,
  DropdownMenuItem,
  EarthIcon,
  HStack,
  isMultiValue,
  KeyIcon,
  LinkIcon,
  LoadingEmptyStatusComponent,
  RawSelect,
  toast,
  Typography,
  useCopyToClipboard,
  VStack,
} from '@letta-cloud/component-library';
import { useDebouncedCallback } from '@mantine/hooks';
import { getShareChatUrl } from '@letta-cloud/generic-utils';
import { useCurrentAgent } from '../../../hooks';

function useCurrentProject() {
  return {
    id: window.location.pathname.split('/')[1] || '',
  };
}

interface ShareAgentPermissionsDropdownProps {
  defaultValue: string;
}

function ShareAgentPermissionsDropdown(
  props: ShareAgentPermissionsDropdownProps,
) {
  const [value, setValue] = useState(props.defaultValue);
  const t = useTranslations('ADE/AgentSimulator');
  const queryClient = useQueryClient();

  const { id: projectId } = useCurrentProject();
  const { id: agentId } = useCurrentAgent();
  const { mutate: updateSharedChatConfiguration } =
    webApi.sharedAgentChats.updateSharedChatConfiguration.useMutation({
      onSuccess: (response) => {
        queryClient.setQueriesData<
          | ServerInferResponses<
              typeof webApiContracts.sharedAgentChats.getSharedChatConfiguration
            >
          | undefined
        >(
          {
            queryKey:
              webApiQueryKeys.sharedAgentChats.getSharedChatConfiguration({
                agentId,
                projectId,
              }),
          },
          () => {
            return response;
          },
        );

        toast.success(t('ShareAgentDialog.success'));
      },
      onError: () => {
        toast.error(t('ShareAgentDialog.error'));
        setValue(props.defaultValue);
      },
    });

  const debouncedUpdateSharedChatConfiguration = useDebouncedCallback(
    updateSharedChatConfiguration,
    500,
  );

  const generalAccessOptions = useMemo(
    () => [
      {
        icon: <CompanyIcon />,
        label: t('ShareAgentDialog.generalAccess.options.organization.label'),
        description: t(
          'ShareAgentDialog.generalAccess.options.organization.description',
        ),
        value: 'organization',
      },
      {
        icon: <KeyIcon />,
        label: t('ShareAgentDialog.generalAccess.options.loggedIn.label'),
        description: t(
          'ShareAgentDialog.generalAccess.options.loggedIn.description',
        ),
        value: 'logged-in',
      },
      {
        icon: <EarthIcon />,
        label: t('ShareAgentDialog.generalAccess.options.everyone.label'),
        description: t(
          'ShareAgentDialog.generalAccess.options.everyone.description',
        ),
        value: 'everyone',
      },
    ],
    [t],
  );

  const getOptionFromValue = useCallback(
    (value: string) => {
      return generalAccessOptions.find((option) => option.value === value);
    },
    [generalAccessOptions],
  );

  return (
    <RawSelect
      labelVariant="simple"
      fullWidth
      label={t('ShareAgentDialog.generalAccess.title')}
      options={generalAccessOptions}
      value={getOptionFromValue(value)}
      onSelect={(val) => {
        if (isMultiValue(val)) {
          return;
        }

        if (!val?.value) {
          return;
        }

        debouncedUpdateSharedChatConfiguration({
          params: {
            agentId: agentId,
            projectId: projectId,
          },
          body: {
            accessLevel: val.value as AccessLevelEnumSchemaType,
          },
        });
        setValue(val.value);
      }}
    />
  );
}

export function ShareAgentDialog() {
  const { id: agentId } = useCurrentAgent();
  const { id: projectId } = useCurrentProject();

  const t = useTranslations('ADE/AgentSimulator');

  const { data } = webApi.sharedAgentChats.getSharedChatConfiguration.useQuery({
    queryKey: webApiQueryKeys.sharedAgentChats.getSharedChatConfiguration({
      agentId,
      projectId,
    }),
    queryData: {
      params: {
        agentId,
        projectId,
      },
    },
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { copyToClipboard } = useCopyToClipboard({
    textToCopy: getShareChatUrl(data?.body.chatId || ''),
  });

  return (
    <Dialog
      isOpen={isDialogOpen}
      onOpenChange={setIsDialogOpen}
      title={t('ShareAgentDialog.title')}
      hideFooter
      trigger={
        <DropdownMenuItem
          doNotCloseOnSelect
          label={t('ShareAgentDialog.trigger')}
        />
      }
    >
      {data ? (
        <VStack paddingBottom>
          <ShareAgentPermissionsDropdown defaultValue={data.body.accessLevel} />
          <Typography color="lighter">
            {t('ShareAgentDialog.description')}
          </Typography>
          <HStack justify="spaceBetween">
            <Button
              color="primary"
              preIcon={<LinkIcon />}
              type="button"
              size="small"
              label={t('ShareAgentDialog.copyLink')}
              onClick={() => {
                void copyToClipboard();
              }}
            />
            <Button
              color="tertiary"
              size="small"
              type="button"
              label={t('ShareAgentDialog.close')}
              onClick={() => {
                setIsDialogOpen(false);
              }}
            />
          </HStack>
        </VStack>
      ) : (
        <LoadingEmptyStatusComponent
          isLoading
          loadingMessage={t('ShareAgentDialog.loading')}
        />
      )}
    </Dialog>
  );
}
