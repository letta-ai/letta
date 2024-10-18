'use client';
import type { panelRegistry } from './panelRegistry';
import { usePanelManager } from './panelRegistry';
import { PanelManagerProvider, PanelRenderer } from './panelRegistry';
import type { PanelItemPositionsMatrix } from '@letta-web/component-library';
import { Badge } from '@letta-web/component-library';
import { UpdateAvailableIcon } from '@letta-web/component-library';
import {
  CogIcon,
  DropdownMenu,
  DropdownMenuItem,
} from '@letta-web/component-library';
import { toast } from '@letta-web/component-library';
import { LayoutIcon } from '@letta-web/component-library';
import {
  ADEHeader,
  ADEPage,
  Alert,
  ArrowUpIcon,
  Avatar,
  Button,
  Dialog,
  Frame,
  HStack,
  KeyIcon,
  LettaLoader,
  SupportIcon,
  Popover,
  Typography,
  DatabaseIcon,
  ForkIcon,
  VStack,
} from '@letta-web/component-library';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentProject } from '../../../../../(dashboard-like)/projects/[projectSlug]/hooks';
import { useDebouncedValue } from '@mantine/hooks';
import { webApi, webApiQueryKeys, webOriginSDKApi } from '$letta/client';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '$letta/client/hooks';
import { CurrentUserDetailsBlock } from '$letta/client/common';
import './AgentPage.scss';
import { useCurrentAgentMetaData } from './hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useCurrentAgent } from './hooks';
import {
  useAgentsServiceGetAgent,
  UseAgentsServiceGetAgentKeyFn,
} from '@letta-web/letta-agents-api';
import { useTranslations } from 'next-intl';
import { ContextWindowPreview } from './ContextEditorPanel/ContextEditorPanel';
import { generateDefaultADELayout } from '$letta/utils';
import { RocketIcon } from '@radix-ui/react-icons';
import { isEqual } from 'lodash-es';
import { generateAgentStateHash } from './AgentSimulator/AgentSimulator';
import { DeployAgentUsageInstructions } from '$letta/client/code-reference/DeployAgentUsageInstructions';
import { useQueryClient } from '@tanstack/react-query';
import type { InfiniteGetProjectDeployedAgentTemplates200Response } from '$letta/web-api/projects/projectContracts';

function RestoreLayoutButton() {
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  const { setPositions } = usePanelManager();

  const handleRestoreLayout = useCallback(() => {
    setPositions(generateDefaultADELayout().displayConfig);
  }, [setPositions]);

  return (
    <DropdownMenuItem
      preIcon={<LayoutIcon />}
      onClick={handleRestoreLayout}
      color="tertiary-transparent"
      label={t('restoreLayout')}
    />
  );
}

export function NavOverlay() {
  const { slug: projectSlug } = useCurrentProject();
  const { name } = useCurrentUser();

  return (
    <Popover
      trigger={
        <HStack align="center">
          <Avatar size="small" name={name} />
        </HStack>
      }
      align="start"
    >
      <CurrentUserDetailsBlock />
      <Frame borderTop color="background-greyer" as="nav">
        <VStack as="ul" paddingY="small" paddingX="xsmall">
          <Button
            href={`/projects/${projectSlug}`}
            color="tertiary-transparent"
            preIcon={<ArrowUpIcon />}
            label="Return to Project"
          />
          <Button
            href="/data-sources"
            target="_blank"
            color="tertiary-transparent"
            label="Data Sources"
            preIcon={<DatabaseIcon />}
          />
          <Button
            target="_blank"
            href="/api-keys"
            color="tertiary-transparent"
            label="API Keys"
            preIcon={<KeyIcon />}
          />
          <Button
            target="_blank"
            href="/support"
            color="tertiary-transparent"
            label="Support"
            preIcon={<SupportIcon />}
          />
        </VStack>
      </Frame>
    </Popover>
  );
}

interface ForkAgentDialogProps {
  onClose: () => void;
}
function ForkAgentDialog(props: ForkAgentDialogProps) {
  const { onClose } = props;
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  const { id: agentTemplateId } = useCurrentAgent();
  const { push } = useRouter();
  const { id: projectId, slug: projectSlug } = useCurrentProject();
  const { mutate, isPending } =
    webApi.agentTemplates.forkAgentTemplate.useMutation();

  const handleForkAgent = useCallback(() => {
    mutate(
      {
        params: {
          projectId,
          agentTemplateId: agentTemplateId,
        },
      },
      {
        onSuccess: (response) => {
          push(`/projects/${projectSlug}/agents/${response.body.name}`);
        },
      }
    );
  }, [agentTemplateId, mutate, projectId, projectSlug, push]);

  return (
    <Dialog
      isOpen
      onOpenChange={(state) => {
        if (!state) {
          onClose();
        }
      }}
      title={t('ForkAgentDialog.title')}
      confirmText={t('ForkAgentDialog.confirm')}
      onConfirm={handleForkAgent}
      isConfirmBusy={isPending}
    >
      {t('ForkAgentDialog.description')}
    </Dialog>
  );
}

interface LoaderContentProps {
  isError?: boolean;
}

function LoaderContent(props: LoaderContentProps) {
  const { isError } = props;

  return (
    <VStack
      /* eslint-disable-next-line react/forbid-component-props */
      className="fixed z-draggedItem top-0 left-0 w-[100vw] h-[100vh]"
      fullHeight
      fullWidth
      align="center"
      justify="center"
    >
      {/* eslint-disable-next-line react/forbid-component-props */}
      <VStack className="loader-content" align="center" gap="large">
        <LettaLoader size="large" />
        <Typography>Setting up your workspace...</Typography>
        {isError && (
          <Alert
            title="There was an error setting up your workspace - please contact support"
            variant="destructive"
          />
        )}
      </VStack>
    </VStack>
  );
}

const PAGE_SIZE = 10;

interface DeployAgentDialogProps {
  isAtLatestVersion: boolean;
}

function DeployAgentDialog(props: DeployAgentDialogProps) {
  const { isAtLatestVersion } = props;
  const { name } = useCurrentAgent();
  const { id: projectId } = useCurrentProject();
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  return (
    <Dialog
      title={t('DeployAgentDialog.title')}
      size="large"
      trigger={
        <Button
          fullWidth
          color={!isAtLatestVersion ? 'tertiary-transparent' : 'primary'}
          label={t('DeployAgentDialog.trigger')}
          target="_blank"
        />
      }
      hideConfirm
    >
      <DeployAgentUsageInstructions
        versionKey={`${name}:latest`}
        projectId={projectId}
      />
    </Dialog>
  );
}

function VersionAgentDialog() {
  const { id: agentTemplateId } = useCurrentAgent();
  const { id: projectId } = useCurrentProject();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  const { mutate, isPending } =
    webOriginSDKApi.agents.versionAgentTemplate.useMutation({
      onSuccess: (response) => {
        void queryClient.setQueriesData<
          InfiniteGetProjectDeployedAgentTemplates200Response | undefined
        >(
          {
            queryKey:
              webApiQueryKeys.projects.getProjectDeployedAgentTemplatesWithSearch(
                projectId,
                {
                  agentTemplateId: agentTemplateId,
                }
              ),
            exact: true,
          },
          (oldData) => {
            if (!oldData) {
              return oldData;
            }

            const [firstPage, ...restPages] = oldData.pages;

            const [_, templateAgentVersion] = response.body.version.split(':');

            return {
              ...oldData,
              pages: [
                {
                  ...firstPage,
                  body: {
                    ...firstPage.body,
                    deployedAgentTemplates: [
                      {
                        id: response.body.agentId || '',
                        version: templateAgentVersion,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        agentTemplateId: agentTemplateId,
                      },
                      ...firstPage.body.deployedAgentTemplates,
                    ],
                  },
                },
                ...restPages,
              ],
            };
          }
        );

        setOpen(false);
      },
    });

  const handleVersionNewAgent = useCallback(() => {
    mutate({
      query: {
        returnAgentId: true,
      },
      params: { agent_id: agentTemplateId },
    });
  }, [mutate, agentTemplateId]);

  return (
    <Dialog
      onOpenChange={setOpen}
      isOpen={open}
      testId="stage-agent-dialog"
      title={t('VersionAgentDialog.title')}
      onConfirm={handleVersionNewAgent}
      isConfirmBusy={isPending}
      trigger={
        <Button
          data-testid="stage-new-version-button"
          color="primary"
          fullWidth
          label={t('VersionAgentDialog.trigger')}
        />
      }
    >
      <VStack gap="form">{t('VersionAgentDialog.description')}</VStack>
    </Dialog>
  );
}

function TemplateVersionDisplay() {
  // get latest template version
  const { id: agentTemplateId } = useCurrentAgent();
  const agentState = useCurrentAgent();
  const { id: currentProjectId, slug: projectSlug } = useCurrentProject();
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  const { data: deployedAgentTemplates } =
    webApi.projects.getProjectDeployedAgentTemplates.useInfiniteQuery({
      queryKey:
        webApiQueryKeys.projects.getProjectDeployedAgentTemplatesWithSearch(
          currentProjectId,
          {
            agentTemplateId: agentTemplateId,
          }
        ),
      queryData: ({ pageParam }) => ({
        params: { projectId: currentProjectId },
        query: {
          agentTemplateId,
          offset: pageParam.offset,
          limit: pageParam.limit,
        },
      }),
      initialPageParam: { offset: 0, limit: PAGE_SIZE },
      getNextPageParam: (lastPage, allPages) => {
        return lastPage.body.hasNextPage
          ? { limit: PAGE_SIZE, offset: allPages.length * PAGE_SIZE }
          : undefined;
      },
    });

  const latestTemplateMetadata = useMemo(() => {
    if (!deployedAgentTemplates) {
      return null;
    }

    return deployedAgentTemplates.pages[0]?.body?.deployedAgentTemplates[0];
  }, [deployedAgentTemplates]);

  const versionNumber = useMemo(() => {
    if (!latestTemplateMetadata) {
      return '';
    }

    return latestTemplateMetadata.version;
  }, [latestTemplateMetadata]);

  const { data: latestTemplate } = webOriginSDKApi.agents.getAgentById.useQuery(
    {
      enabled: !!latestTemplateMetadata?.id,
      queryData: {
        params: {
          agent_id: latestTemplateMetadata?.id || '',
        },
        query: {
          all: true,
        },
      },
      queryKey: UseAgentsServiceGetAgentKeyFn({
        agentId: latestTemplateMetadata?.id || '',
      }),
    }
  );

  const isAtLatestVersion = useMemo(() => {
    if (!latestTemplate?.body) {
      return false;
    }

    const {
      message_ids: _m,
      created_at: _c,
      name: _name,
      id: _id,
      ...rest
    } = agentState;
    const {
      message_ids: _m2,
      created_at: _m3,
      name: _name2,
      id: _id2,
      ...rest2
    } = latestTemplate.body;

    return isEqual(
      generateAgentStateHash(rest, []),
      generateAgentStateHash(rest2, [])
    );
  }, [agentState, latestTemplate]);

  const { name } = useCurrentAgent();

  return (
    <Popover
      trigger={
        <Button
          hideLabel
          label={
            isAtLatestVersion
              ? t('DeploymentButton.readyToDeploy.trigger')
              : t('DeploymentButton.updateAvailable.trigger')
          }
          preIcon={isAtLatestVersion ? <RocketIcon /> : <UpdateAvailableIcon />}
        />
      }
      align="end"
    >
      <VStack padding="small">
        <VStack padding="small">
          {versionNumber && (
            <HStack>
              <Badge
                color="primary"
                content={t('DeploymentButton.version', {
                  version: versionNumber,
                })}
              />
            </HStack>
          )}
          <Typography variant="heading4" bold>
            {isAtLatestVersion
              ? t('DeploymentButton.readyToDeploy.heading')
              : t('DeploymentButton.updateAvailable.heading')}
          </Typography>
          <Typography>
            {isAtLatestVersion
              ? t('DeploymentButton.readyToDeploy.copy')
              : t('DeploymentButton.updateAvailable.copy')}
          </Typography>
        </VStack>
        <VStack gap="small">
          {!isAtLatestVersion && <VersionAgentDialog />}
          <DeployAgentDialog isAtLatestVersion={isAtLatestVersion} />
          <Button
            fullWidth
            target="_blank"
            color="tertiary-transparent"
            label={t('VersionAgentDialog.deployedAgents')}
            href={`/projects/${projectSlug}/agents?template=${name}:${versionNumber}`}
          />
        </VStack>
      </VStack>
    </Popover>
  );
}

type Dialogs = 'forkAgent';

function AgentSettingsDropdown() {
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );
  const [openDialog, setOpenDialog] = useState<Dialogs | null>(null);

  const handleCloseDialog = useCallback(() => {
    setOpenDialog(null);
  }, []);

  return (
    <>
      {openDialog == 'forkAgent' && (
        <ForkAgentDialog onClose={handleCloseDialog} />
      )}
      <DropdownMenu
        align="end"
        triggerAsChild
        trigger={
          <Button
            preIcon={<CogIcon />}
            label={t('AgentSettingsDropdown.trigger')}
            hideLabel
            size="small"
            color="tertiary-transparent"
          />
        }
      >
        <DropdownMenuItem
          onClick={() => {
            setOpenDialog('forkAgent');
          }}
          preIcon={<ForkIcon />}
          label={t('ForkAgentDialog.trigger')}
        />
        <RestoreLayoutButton />
      </DropdownMenu>
    </>
  );
}

export function AgentPage() {
  const { name: projectName, slug: projectSlug } = useCurrentProject();
  const { agentName, agentId, isTemplate, isLocal } = useCurrentAgentMetaData();
  const { data, isError } = webApi.adePreferences.getADEPreferences.useQuery({
    queryKey: webApiQueryKeys.adePreferences.getADEPreferences(agentId),
    queryData: {
      params: {
        agentId,
      },
    },
  });

  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage'
  );

  const { data: agent } = useAgentsServiceGetAgent({
    agentId,
  });

  const { mutate } = webApi.adePreferences.updateADEPreferences.useMutation();

  const [updatedPositions, setUpdatedPositions] = useState<
    PanelItemPositionsMatrix<keyof typeof panelRegistry>
  >([]);

  const [debouncedPositions] = useDebouncedValue(updatedPositions, 500);

  useEffect(() => {
    if (debouncedPositions.length) {
      mutate({
        params: {
          agentId,
        },
        body: {
          displayConfig: debouncedPositions,
        },
      });
    }
  }, [agentId, debouncedPositions, mutate]);

  const fullPageWarning = useMemo(() => {
    if (isLocal) {
      return t('localAgentDevelopment');
    }

    if (!isTemplate) {
      return t('liveAgentWarning');
    }

    return null;
  }, [isLocal, isTemplate, t]);

  if (!data?.body?.displayConfig || !agent) {
    return <LoaderContent isError={isError} />;
  }

  return (
    <>
      <div className="agent-page-fade-out fixed pointer-events-none z-[-1]">
        <LoaderContent />
      </div>
      <PanelManagerProvider
        onPositionError={() => {
          toast.error(t('positionError'));
        }}
        templateIdDenyList={!isTemplate ? ['deployment'] : []}
        fallbackPositions={generateDefaultADELayout().displayConfig}
        initialPositions={data.body.displayConfig}
        onPositionChange={setUpdatedPositions}
      >
        <ADEPage
          header={
            <ADEHeader
              project={{
                url: isLocal
                  ? '/local-project/agents'
                  : `/projects/${projectSlug}`,
                name: isLocal ? 'Local Project' : projectName,
              }}
              agent={{
                name: agentName,
              }}
            >
              <HStack align="center">
                <ContextWindowPreview />
                <AgentSettingsDropdown />
                {/*<NavOverlay />*/}
                {isTemplate && <TemplateVersionDisplay />}
              </HStack>
            </ADEHeader>
          }
        >
          <VStack overflow="hidden" position="relative" fullWidth fullHeight>
            {fullPageWarning && (
              <Alert variant="warning" title={fullPageWarning} />
            )}
            <Frame overflow="hidden" position="relative" fullWidth fullHeight>
              <PanelRenderer />
            </Frame>
          </VStack>
        </ADEPage>
      </PanelManagerProvider>
    </>
  );
}
