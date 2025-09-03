import React, { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useQueryClient } from '@tanstack/react-query';
import {
  type GetSharedAgentChatConfigurationSchemaType,
  webApi,
  webApiQueryKeys,
} from '@letta-cloud/sdk-web';
import type {
  AccessLevelEnumSchemaType,
  webApiContracts,
} from '@letta-cloud/sdk-web';
import type { ServerInferResponses } from '@ts-rest/core';
import {
  Button,
  CompanyIcon,
  Dialog,
  DropdownMenuItem,
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
} from '@letta-cloud/ui-component-library';
import { useDebouncedCallback } from '@mantine/hooks';
import { getShareChatUrl } from '@letta-cloud/utils-shared';
import { useCurrentAgent } from '../../../../hooks';
import { useADEAppContext } from '../../../../AppContext/AppContext';

interface ShareAgentPermissionsDropdownProps {
  defaultValue: string;
}

function ShareAgentPermissionsDropdown(
  props: ShareAgentPermissionsDropdownProps,
) {
  const [value, setValue] = useState(props.defaultValue);
  const t = useTranslations('ADE/AgentSimulator');
  const queryClient = useQueryClient();

  const { projectId } = useADEAppContext();
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
      // {
      //   icon: <EarthIcon />,
      //   label: t('ShareAgentDialog.generalAccess.options.everyone.label'),
      //   description: t(
      //     'ShareAgentDialog.generalAccess.options.everyone.description',
      //   ),
      //   value: 'everyone',
      // },
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

interface ShareContentProps {
  schema: GetSharedAgentChatConfigurationSchemaType;
  onClose: () => void;
}

function ShareContent(props: ShareContentProps) {
  const { schema, onClose } = props;

  const { chatId, accessLevel, isFromLaunchLink } = schema;

  const { copyToClipboard } = useCopyToClipboard({
    textToCopy: getShareChatUrl(chatId || ''),
  });

  const t = useTranslations('ADE/AgentSimulator');

  if (isFromLaunchLink) {
    return (
      <VStack paddingBottom>
        <Typography color="lighter">
          {t('ShareAgentDialog.launchLinkDescription')}
        </Typography>
      </VStack>
    );
  }

  return (
    <VStack paddingBottom>
      <ShareAgentPermissionsDropdown defaultValue={accessLevel} />
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
            onClose();
          }}
        />
      </HStack>
    </VStack>
  );
}

export function ShareAgentDialog() {
  const { id: agentId } = useCurrentAgent();
  const { projectId } = useADEAppContext();

  const t = useTranslations('ADE/AgentSimulator');

  const { data } = webApi.sharedAgentChats.getSharedChatConfiguration.useQuery({
    queryKey: webApiQueryKeys.sharedAgentChats.getSharedChatConfiguration({
      agentId,
      projectId,
    }),
    queryData: {
      query: {
        upsert: true,
      },
      params: {
        agentId,
        projectId,
      },
    },
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
        <ShareContent
          schema={data.body}
          onClose={() => {
            setIsDialogOpen(false);
          }}
        />
      ) : (
        <LoadingEmptyStatusComponent
          isLoading
          loadingMessage={t('ShareAgentDialog.loading')}
        />
      )}
    </Dialog>
  );
}
