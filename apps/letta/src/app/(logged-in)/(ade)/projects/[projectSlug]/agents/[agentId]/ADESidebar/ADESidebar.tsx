import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useADESidebarContext, useCurrentAgent } from '../hooks';
import type {
  DialogTableItem,
  PanelTemplate,
} from '@letta-web/component-library';
import { RocketIcon } from '@letta-web/component-library';
import { LoadingEmptyStatusComponent } from '@letta-web/component-library';
import { DialogTable } from '@letta-web/component-library';
import {
  ActionCard,
  Button,
  Dialog,
  PlusIcon,
  RawInput,
} from '@letta-web/component-library';
import { ADESidebarButton } from '@letta-web/component-library';
import {
  ChatBubbleIcon,
  HStack,
  MaybeTooltip,
  Typography,
  VStack,
} from '@letta-web/component-library';
import type { panelRegistry } from '../panelRegistry';
import { PanelToggle, usePanelManager } from '../panelRegistry';
import {
  BotIcon,
  BoxesIcon,
  BrainIcon,
  BrickWallIcon,
  ChevronDown,
  ChevronRight,
  DatabaseIcon,
  DatabaseZapIcon,
  PenToolIcon,
  SearchIcon,
  Settings2Icon,
} from 'lucide-react';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useCurrentAgentMetaData } from '../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import type { AgentsServiceGetAgentSourcesDefaultResponse } from '@letta-web/letta-agents-api';
import { useSourcesServiceCreateSource } from '@letta-web/letta-agents-api';
import {
  useAgentsServiceGetAgentSources,
  UseAgentsServiceGetAgentSourcesKeyFn,
  useSourcesServiceAttachAgentToSource,
  useSourcesServiceListSources,
} from '@letta-web/letta-agents-api';
import { useQueryClient } from '@tanstack/react-query';
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import { atom, useAtom } from 'jotai';

type PanelRegistryKeys = keyof typeof panelRegistry;

interface SidebarGroupProps {
  title: string;
  children: React.ReactNode;
}

function SidebarGroup(props: SidebarGroupProps) {
  const { title, children } = props;
  const { collapsed } = useADESidebarContext();

  return (
    <VStack
      borderBottom
      paddingBottom
      gap={false}
      color="transparent"
      as="section"
    >
      <HStack paddingY="small" paddingX="small" align="center">
        {!collapsed && (
          <Typography bold variant="body2">
            {title}
          </Typography>
        )}
      </HStack>
      <VStack gap="small" as="ul">
        {children}
      </VStack>
    </VStack>
  );
}

interface ADEFolderSidebarItemProps {
  label: string;
  templateId: PanelRegistryKeys;
  children: React.ReactNode;
}

export const folderStatesAtom = atom<Record<string, boolean>>({});

function ADEFolderSidebarItem(props: ADEFolderSidebarItemProps) {
  const [folderStates, setFolderStates] = useAtom(folderStatesAtom);

  const setOpen = useCallback(
    (state: boolean) => {
      setFolderStates((prev) => ({
        ...prev,
        [props.templateId]: state,
      }));
    },
    [props.templateId, setFolderStates]
  );

  const open = useMemo(() => {
    return folderStates[props.templateId] || false;
  }, [folderStates, props.templateId]);

  const { label, templateId, children } = props;

  const { getIsPanelTemplateActive } = usePanelManager();

  const isActive = useMemo(() => {
    return getIsPanelTemplateActive(templateId);
  }, [getIsPanelTemplateActive, templateId]);

  useEffect(() => {
    if (isActive) {
      setOpen(true);
    }
  }, [isActive, setOpen]);

  return (
    <>
      <MaybeTooltip renderTooltip={false} placement="right" content={label}>
        <HStack fullWidth align="center" paddingX="small">
          <ADESidebarButton
            label={label}
            onClick={() => {
              setOpen(!open);
            }}
            icon={open ? <ChevronDown /> : <ChevronRight />}
          />
        </HStack>
      </MaybeTooltip>
      {open && <div className="ml-3">{children}</div>}
    </>
  );
}

interface AgentPanelSidebarCreateItemProps {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

function AgentPanelSidebarCreateItem(props: AgentPanelSidebarCreateItemProps) {
  const { label, icon, onClick } = props;
  return (
    <MaybeTooltip renderTooltip={false} placement="right" content={label}>
      <HStack fullWidth align="center" paddingX="small">
        <ADESidebarButton label={label} icon={icon} onClick={onClick} />
      </HStack>
    </MaybeTooltip>
  );
}

interface AgentPanelSidebarItemProps<
  TPanelTemplateId extends PanelRegistryKeys
> {
  label: string;
  icon: React.ReactNode;
  preview?: React.ReactNode;
  templateId: TPanelTemplateId;
  data: (typeof panelRegistry)[TPanelTemplateId]['data']['_output'];
  id: string;
}

function AgentPanelSidebarItem<TPanelTemplateId extends PanelRegistryKeys>(
  props: AgentPanelSidebarItemProps<TPanelTemplateId>
) {
  const { label, icon, templateId, preview, id, data } = props;
  const { getIsPanelIdExists } = usePanelManager();

  const isActive = useMemo(() => {
    return getIsPanelIdExists(id);
  }, [getIsPanelIdExists, id]);

  return (
    <MaybeTooltip
      asChild
      renderTooltip={false}
      placement="right"
      content={label}
    >
      <HStack fullWidth align="center" paddingX="small">
        <PanelToggle id={id} templateId={templateId} data={data}>
          <ADESidebarButton
            label={label}
            icon={icon}
            preview={preview}
            isActive={isActive}
          />
        </PanelToggle>
      </HStack>
    </MaybeTooltip>
  );
}

function MemoryBlocksSidebar() {
  const t = useTranslations('ADE/ADESidebar');
  const agent = useCurrentAgent();

  const memoryBlocks = useMemo(() => {
    return Object.values(agent?.memory?.memory || {});
  }, [agent]);

  return (
    <ADEFolderSidebarItem
      label={t('nav.memoryBlocks')}
      templateId="edit-memory-block"
    >
      {memoryBlocks.map((block) => (
        <AgentPanelSidebarItem
          key={block.id}
          label={block.name || 'Unnamed Block'}
          icon={<BrickWallIcon />}
          templateId="edit-memory-block"
          data={{
            label: block.label || '',
            name: block.name || '',
            blockId: block.id || '',
          }}
          id={`memory-blocks-edit-${block.label}`}
        />
      ))}
    </ADEFolderSidebarItem>
  );
}

interface AttachDataSourceViewProps {
  onClose: () => void;
  setMode: (mode: CreateDataSourceDialogMode) => void;
}

function AttachDataSourceView(props: AttachDataSourceViewProps) {
  const { id } = useCurrentAgent();
  const { onClose, setMode } = props;
  const { data: allSources } = useSourcesServiceListSources();

  const queryClient = useQueryClient();

  const t = useTranslations('ADE/ADESidebar');

  const { mutate, isPending } = useSourcesServiceAttachAgentToSource({
    onSuccess: (_, variables) => {
      const newSource = allSources?.find(
        (source) => source.id === variables.sourceId
      );

      if (!newSource) {
        return;
      }

      queryClient.setQueriesData<
        AgentsServiceGetAgentSourcesDefaultResponse | undefined
      >(
        {
          queryKey: UseAgentsServiceGetAgentSourcesKeyFn({
            agentId: id,
          }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return [newSource, ...oldData];
        }
      );

      onClose();
    },
  });

  const { data: existingSources } = useAgentsServiceGetAgentSources({
    agentId: id,
  });

  const existingSourcesIdSet = useMemo(() => {
    if (!existingSources) {
      return new Set<string>();
    }

    return new Set(existingSources.map((source) => source.id));
  }, [existingSources]);

  const handleAttachSource = useCallback(
    (sourceId: string) => {
      mutate({
        agentId: id,
        sourceId,
      });
    },
    [id, mutate]
  );

  const [search, setSearch] = useState('');

  const sources: DialogTableItem[] = useMemo(() => {
    if (!allSources) {
      return [];
    }

    return allSources
      .filter((source) =>
        source.name.toLowerCase().includes(search.toLowerCase())
      )
      .map((source) => {
        const isAttached = existingSourcesIdSet.has(source.id || '');

        return {
          icon: <DatabaseIcon />,
          label: source.name,
          action: (
            <Button
              color="secondary"
              type="button"
              disabled={isAttached}
              size="small"
              busy={isPending}
              onClick={() => {
                handleAttachSource(source.id || '');
              }}
              label={
                isAttached
                  ? t('AttachDataSourceView.attached')
                  : t('AttachDataSourceView.attach')
              }
            />
          ),
        };
      });
  }, [
    allSources,
    existingSourcesIdSet,
    handleAttachSource,
    isPending,
    search,
    t,
  ]);

  return (
    <VStack>
      <HStack>
        <RawInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          preIcon={<SearchIcon />}
          fullWidth
          hideLabel
          label={t('AttachDataSourceView.searchInput.label')}
          placeholder={t('AttachDataSourceView.searchInput.placeholder')}
        />
      </HStack>
      <DialogTable
        items={sources}
        emptyAction={
          !search && (
            <Button
              color="secondary"
              size="small"
              label={t('AttachDataSourceView.emptyAction')}
              onClick={() => {
                setMode('create');
              }}
            />
          )
        }
        emptyMessage={
          search
            ? t('AttachDataSourceView.emptySearchMessage')
            : t('AttachDataSourceView.emptyMessage')
        }
        isLoading={!allSources}
      />
    </VStack>
  );
}

type CreateDataSourceDialogMode = 'attach' | 'create' | null;

interface CreateDataSourceDialogInnerProps {
  mode: CreateDataSourceDialogMode;
  onClose: () => void;
  setMode: (mode: CreateDataSourceDialogMode) => void;
}

function CreateDataSourceDialogInner(props: CreateDataSourceDialogInnerProps) {
  const { mode, onClose, setMode } = props;
  const t = useTranslations('ADE/ADESidebar');
  const { id } = useCurrentAgent();

  const { mutate: createDataSource, isPending: isCreatingDataSource } =
    useSourcesServiceCreateSource();
  const { mutate: attachDataSource, isPending: isAttachingDataSource } =
    useSourcesServiceAttachAgentToSource();
  const queryClient = useQueryClient();
  const isPending = useMemo(() => {
    return isCreatingDataSource || isAttachingDataSource;
  }, [isCreatingDataSource, isAttachingDataSource]);

  const handleCreateDataSource = useCallback(() => {
    if (isPending) {
      return;
    }

    const randomName = uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      length: 3,
      separator: '-',
    });

    createDataSource(
      {
        requestBody: {
          name: randomName,
          description: '',
        },
      },
      {
        onSuccess: (response) => {
          attachDataSource(
            {
              agentId: id,
              sourceId: response.id || '',
            },
            {
              onSuccess: () => {
                queryClient.setQueriesData<
                  AgentsServiceGetAgentSourcesDefaultResponse | undefined
                >(
                  {
                    queryKey: UseAgentsServiceGetAgentSourcesKeyFn({
                      agentId: id,
                    }),
                  },
                  (oldData) => {
                    if (!oldData) {
                      return oldData;
                    }

                    return [response, ...oldData];
                  }
                );

                onClose();
              },
            }
          );
        },
      }
    );
  }, [attachDataSource, createDataSource, id, isPending, onClose, queryClient]);

  switch (mode) {
    case 'attach':
      return <AttachDataSourceView setMode={setMode} onClose={onClose} />;
    case 'create':
      return (
        <LoadingEmptyStatusComponent
          emptyMessage=""
          isLoading
          loadingMessage={t('CreateDataSourceDialog.creatingDataSource')}
        />
      );
    default:
      return (
        <VStack>
          <ActionCard
            icon={<DatabaseZapIcon />}
            onCardClick={() => {
              setMode('attach');
            }}
            title={t(
              'CreateDataSourceDialog.options.attachAnExistingDataSource.title'
            )}
            subtitle={t(
              'CreateDataSourceDialog.options.attachAnExistingDataSource.description'
            )}
          />
          <ActionCard
            onCardClick={() => {
              setMode('create');
              handleCreateDataSource();
            }}
            icon={<DatabaseIcon />}
            title={t(
              'CreateDataSourceDialog.options.createANewDataSource.title'
            )}
            subtitle={t(
              'CreateDataSourceDialog.options.createANewDataSource.description'
            )}
          />
        </VStack>
      );
  }
}

function CreateDataSourceDialog() {
  const [open, setOpen] = useState(false);
  const t = useTranslations('ADE/ADESidebar');
  const [mode, setMode] = useState<'attach' | 'create' | null>(null);

  const handleOpenChange = useCallback((state: boolean) => {
    setOpen(state);
    if (!state) {
      setMode(null);
    }
  }, []);

  return (
    <Dialog
      reverseButtons
      isOpen={open}
      onOpenChange={handleOpenChange}
      size="large"
      hideConfirm={mode !== 'attach'}
      preventCloseFromOutside={mode === 'create'}
      confirmColor="tertiary-transparent"
      confirmText={t('CreateDataSourceDialog.goBack')}
      onConfirm={() => {
        setMode(null);
      }}
      trigger={
        <AgentPanelSidebarCreateItem
          icon={<PlusIcon />}
          label={t('nav.dataSources.new')}
        />
      }
      title="Add new data source"
    >
      <CreateDataSourceDialogInner
        mode={mode}
        onClose={() => {
          setOpen(false);
        }}
        setMode={setMode}
      />
    </Dialog>
  );
}

function DataSourcesSidebar() {
  const t = useTranslations('ADE/ADESidebar');
  const { id } = useCurrentAgent();
  const { data: agentSources } = useAgentsServiceGetAgentSources({
    agentId: id,
  });

  return (
    <ADEFolderSidebarItem
      label={t('nav.dataSources.main')}
      templateId="edit-data-source"
    >
      {agentSources?.map((source) => (
        <AgentPanelSidebarItem
          key={source.id}
          label={source.name}
          icon={<DatabaseIcon />}
          templateId="edit-data-source"
          data={{
            id: source.id || '',
            name: source.name || '',
          }}
          id={`edit-data-source-${source.id}`}
        />
      ))}
      <CreateDataSourceDialog />
    </ADEFolderSidebarItem>
  );
}

function AgentPageSidebar() {
  const currentAgent = useCurrentAgent();
  const t = useTranslations('ADE/ADESidebar');
  const { isTemplate } = useCurrentAgentMetaData();

  return (
    <VStack
      fullHeight
      borderRight
      color="background-grey"
      as="nav"
      fullWidth
      justify="spaceBetween"
      overflowY="auto"
      overflowX="hidden"
    >
      <VStack>
        <SidebarGroup title={t('nav.base')}>
          <AgentPanelSidebarItem
            label={t('nav.model')}
            icon={<BotIcon />}
            preview={currentAgent.llm_config.model}
            templateId="model-details"
            data={undefined}
            id="model-details"
          />
          <AgentPanelSidebarItem
            label={t('nav.config')}
            icon={<Settings2Icon />}
            templateId="agent-config"
            data={undefined}
            id="agent-config"
          />
        </SidebarGroup>
        <SidebarGroup title={t('nav.configure')}>
          <MemoryBlocksSidebar />
          <DataSourcesSidebar />
          <AgentPanelSidebarItem
            label={t('nav.tools')}
            icon={<PenToolIcon />}
            templateId="tools-panel"
            data={undefined}
            id="tools-panel"
          />
        </SidebarGroup>
        <SidebarGroup title={t('nav.test')}>
          <AgentPanelSidebarItem
            label={t('nav.agentSimulator')}
            icon={<ChatBubbleIcon />}
            templateId="agent-simulator"
            data={undefined}
            id="agent-simulator"
          />
          <AgentPanelSidebarItem
            label={t('nav.archivalMemories')}
            icon={<BrainIcon />}
            templateId="archival-memories"
            data={{}}
            id="archival-memories"
          />
        </SidebarGroup>
        {isTemplate && (
          <SidebarGroup title="Distribute">
            <AgentPanelSidebarItem
              label={t('nav.templateVersionManager')}
              icon={<BoxesIcon />}
              templateId="deployment"
              data={undefined}
              id="deployment"
            />
            <AgentPanelSidebarItem
              label={t('nav.deployedAgents')}
              icon={<RocketIcon />}
              templateId="deployed-agents"
              data={undefined}
              id="deployed-agents"
            />
          </SidebarGroup>
        )}
      </VStack>
    </VStack>
  );
}

export const agentSidebarTemplate = {
  templateId: 'sidebar',
  content: AgentPageSidebar,
  useGetTitle: () => 'Sd',
  noTab: true,
  data: z.undefined(),
} satisfies PanelTemplate<'sidebar'>;
