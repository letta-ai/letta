import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ActionCard,
  Avatar,
  Badge,
  Button,
  Card,
  DashboardEmptyArea,
  Dialog,
  Form,
  FormActions,
  HStack,
  LoadingEmptyStatusComponent,
  NiceGridDisplay,
  PlusIcon,
  RawKeyValueEditor,
  Section,
  StarterKitItems,
  Typography,
  VStack,
} from '@letta-cloud/component-library';
import type { KeyValue } from '@letta-cloud/component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '../../hooks';
import { webApi, webApiQueryKeys, webOriginSDKApi } from '$web/client';
import { useRouter } from 'next/navigation';
import { findMemoryBlockVariables } from '@letta-cloud/generic-utils';
import { STARTER_KITS } from '@letta-cloud/agent-starter-kits';
import type { AgentState } from '@letta-cloud/letta-agents-api';

const elementWidth = '204px';
const elementHeight = '166px';

interface DeployFromTemplateProps {
  onSelectTemplate: (template: SelectedTemplate) => void;
}

function DeployFromTemplate(props: DeployFromTemplateProps) {
  const { onSelectTemplate } = props;
  const t = useTranslations(
    'projects/(projectSlug)/agents/page/DeployAgentDialog',
  );
  const { id: currentProjectId } = useCurrentProject();

  const [search, setSearch] = React.useState('');

  const query = useMemo(() => {
    return {
      search,
      projectId: currentProjectId,
      offset: 0,
      limit: 4,
      includeLatestDeployedVersion: true,
    };
  }, [search, currentProjectId]);

  const { data } = webApi.agentTemplates.listAgentTemplates.useQuery({
    queryKey:
      webApiQueryKeys.agentTemplates.listAgentTemplatesWithSearch(query),
    queryData: {
      query,
    },
  });

  const templates = useMemo(() => {
    if (!data) {
      return null;
    }

    return data?.body.agentTemplates || [];
  }, [data]);

  return (
    <Section
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder={t('DeployFromTemplate.searchPlaceholder')}
      title={t('DeployFromTemplate.title')}
      description={t('DeployFromTemplate.description')}
    >
      {templates && templates.length === 0 ? (
        <NiceGridDisplay itemWidth="100%" itemHeight={elementHeight}>
          <DashboardEmptyArea
            message={
              !search
                ? t('DeployFromTemplate.noItems')
                : t('DeployFromTemplate.notFound')
            }
          />
        </NiceGridDisplay>
      ) : (
        <NiceGridDisplay itemWidth={elementWidth} itemHeight={elementHeight}>
          {templates
            ? templates
                .filter((template) => template.latestDeployedId)
                .map((template, index) => (
                  <Card
                    testId={`deploy-from-template-card:${index}`}
                    onClick={() => {
                      if (template.latestDeployedId) {
                        onSelectTemplate({
                          id: template.id,
                          version: `${template.name}:${
                            template.latestDeployedVersion || '1'
                          }`,
                        });
                      }
                    }}
                    key={template.id}
                  >
                    <VStack>
                      <Avatar
                        size="xxlarge"
                        name={template.name.replace('-', ' ')}
                      />
                      <Typography align="left" bold>
                        {template.name}
                      </Typography>
                      <Typography align="left" color="lighter">
                        {t('DeployFromTemplate.items.noDescription')}
                      </Typography>
                      <HStack>
                        <Badge
                          content={t('DeployFromTemplate.items.version', {
                            version: template.latestDeployedVersion || '1',
                          })}
                        />
                      </HStack>
                    </VStack>
                  </Card>
                ))
            : new Array(4)
                .fill(null)
                .map((_, index) => (
                  <ActionCard title="" key={index} isSkeleton />
                ))}
        </NiceGridDisplay>
      )}
    </Section>
  );
}

interface FromStarterKitProps {
  onIsCreating: (isCreating: boolean) => void;
  onError: () => void;
}

function FromStarterKit(props: FromStarterKitProps) {
  const { onIsCreating, onError } = props;
  const t = useTranslations(
    'projects/(projectSlug)/agents/page/DeployAgentDialog',
  );

  const { slug, id: projectId } = useCurrentProject();

  const starterKits = useMemo(() => {
    return Object.entries(STARTER_KITS);
  }, []);

  const { push } = useRouter();

  const { mutate } = webApi.starterKits.createAgentFromStarterKit.useMutation({
    onError: () => {
      onIsCreating(false);
      onError();
    },
    onSuccess: (data) => {
      push(`/projects/${slug}/agents/${data.body.agentId}`);
    },
  });

  const handleSelectStarterKit = useCallback(
    (starterKitId: string) => {
      onIsCreating(true);

      mutate({
        params: {
          starterKitId,
        },
        body: {
          projectId,
        },
      });
    },
    [mutate, onIsCreating, projectId],
  );

  return (
    <Section
      title={t('FromStarterKit.title')}
      description={t('FromStarterKit.description')}
    >
      <NiceGridDisplay itemWidth={elementWidth} itemHeight={elementHeight}>
        {starterKits.map(([id, starterKit]) => (
          <StarterKitItems
            onSelectStarterKit={() => {
              handleSelectStarterKit(starterKit.id);
            }}
            key={id}
            starterKit={starterKit}
          />
        ))}
      </NiceGridDisplay>
    </Section>
  );
}

interface SelectedTemplate {
  version: string;
  id: string;
}

interface SelectedTemplateStateWrapperProps {
  selectedTemplate: SelectedTemplate;
  onReset: () => void;
  onCreating: (isCreating: boolean) => void;
  onErrored: () => void;
}

function SelectedTemplateStateWrapper(
  props: SelectedTemplateStateWrapperProps,
) {
  const { selectedTemplate, onReset, onCreating, onErrored } = props;

  const { data } = webApi.agentTemplates.getAgentTemplateById.useQuery({
    queryKey: webApiQueryKeys.agentTemplates.getAgentTemplateById(
      selectedTemplate.id,
    ),
    queryData: {
      params: {
        id: selectedTemplate.id,
      },
      query: {
        includeState: true,
      },
    },
  });

  const agent = useMemo(() => {
    return data?.body.agentState;
  }, [data]);

  const t = useTranslations(
    'projects/(projectSlug)/agents/page/DeployAgentDialog',
  );

  const memoryVariablesInTemplate = useMemo(() => {
    if (!agent) {
      return null;
    }

    return findMemoryBlockVariables(agent as AgentState);
  }, [agent]);

  const toolVariablesInTemplate = useMemo(() => {
    if (!agent) {
      return [];
    }

    return (agent.tool_exec_environment_variables || [])?.map(
      (item) => item.key,
    );
  }, [agent]);

  if (!agent) {
    return (
      <LoadingEmptyStatusComponent
        emptyMessage=""
        isLoading
        loadingMessage={t('SelectedTemplateState.readying')}
      />
    );
  }

  return (
    <SelectedTemplateState
      selectedTemplate={selectedTemplate}
      onReset={onReset}
      onCreating={onCreating}
      onErrored={onErrored}
      memoryVariablesInTemplate={memoryVariablesInTemplate}
      toolVariablesInTemplate={toolVariablesInTemplate}
    />
  );
}

interface SelectedTemplateStateProps extends SelectedTemplateStateWrapperProps {
  memoryVariablesInTemplate: string[] | null;
  toolVariablesInTemplate: string[];
}

function SelectedTemplateState(props: SelectedTemplateStateProps) {
  const {
    selectedTemplate,
    memoryVariablesInTemplate,
    toolVariablesInTemplate,
    onReset,
    onCreating,
    onErrored,
  } = props;
  const t = useTranslations(
    'projects/(projectSlug)/agents/page/DeployAgentDialog',
  );
  const { push } = useRouter();
  const { slug: projectSlug } = useCurrentProject();

  const {
    mutate: createAgent,
    isSuccess,
    isPending,
  } = webOriginSDKApi.templates.createAgentsFromTemplate.useMutation({
    onError: onErrored,
    onSuccess: (data) => {
      push(`/projects/${projectSlug}/agents/${data.body.agents[0].id}`);
    },
  });

  const [memoryVariables, setMemoryVariables] = React.useState<KeyValue[]>(
    memoryVariablesInTemplate
      ? memoryVariablesInTemplate.map((item) => ({ key: item, value: '' }))
      : [],
  );

  const [toolVariables, setToolVariables] = React.useState<KeyValue[]>(
    toolVariablesInTemplate
      ? toolVariablesInTemplate.map((item) => ({ key: item, value: '' }))
      : [],
  );

  const handleCreateAgent = useCallback(() => {
    onCreating(true);

    if (isSuccess || isPending) {
      return;
    }

    createAgent({
      params: {
        project: projectSlug,
        template_version: selectedTemplate.version,
      },
      body: {
        memory_variables: Object.fromEntries(
          memoryVariables.map(({ key, value }) => [key, value]),
        ),
        tool_variables: Object.fromEntries(
          toolVariables.map(({ key, value }) => [key, value]),
        ),
      },
    });
  }, [
    createAgent,
    isPending,
    isSuccess,
    projectSlug,
    onCreating,
    toolVariables,
    selectedTemplate.version,
    memoryVariables,
  ]);

  useEffect(() => {
    if (isPending || isSuccess) {
      return;
    }

    if (!memoryVariablesInTemplate) {
      return;
    }

    if (
      memoryVariablesInTemplate.length === 0 &&
      toolVariablesInTemplate.length === 0
    ) {
      handleCreateAgent();
    }
  }, [
    handleCreateAgent,
    isPending,
    isSuccess,
    memoryVariablesInTemplate,
    toolVariablesInTemplate.length,
  ]);

  return (
    <VStack fullHeight flex>
      <Section
        fullHeight
        title={t('SelectedTemplateState.title')}
        description={t('SelectedTemplateState.description')}
      >
        <VStack paddingBottom flex fullHeight>
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateAgent();
            }}
          >
            <VStack paddingTop flex fullHeight gap="form">
              <VStack fullHeight gap="form" flex>
                {memoryVariablesInTemplate && (
                  <RawKeyValueEditor
                    freezeRows
                    fullWidth
                    disableKey
                    label={t('SelectedTemplateState.memoryVariables.label')}
                    value={memoryVariables}
                    onValueChange={setMemoryVariables}
                  />
                )}
                {toolVariablesInTemplate.length > 0 && (
                  <RawKeyValueEditor
                    freezeRows
                    disableKey
                    fullWidth
                    label={t('SelectedTemplateState.toolVariables.label')}
                    value={toolVariables}
                    onValueChange={setToolVariables}
                  />
                )}
              </VStack>
              <FormActions>
                <Button
                  type="button"
                  onClick={onReset}
                  label={t('SelectedTemplateState.return')}
                  color="secondary"
                />
                <Button
                  type="submit"
                  data-testid="complete-create-agent-button"
                  label={t('SelectedTemplateState.create')}
                  preIcon={<PlusIcon />}
                  color="primary"
                />
              </FormActions>
            </VStack>
          </Form>
        </VStack>
      </Section>
    </VStack>
  );
}

interface DeployAgentViewContentsProps {
  isCreating: boolean;
  setIsCreating: (isCreating: boolean) => void;
  setIsError: (isError: boolean) => void;
  selectedTemplate: SelectedTemplate | null;
  setSelectedTemplate: (template: SelectedTemplate | null) => void;
}

function DeployAgentViewContents(props: DeployAgentViewContentsProps) {
  const {
    isCreating,
    setIsCreating,
    setIsError,
    selectedTemplate,
    setSelectedTemplate,
  } = props;

  const t = useTranslations(
    'projects/(projectSlug)/agents/page/DeployAgentDialog',
  );

  const handleCreating = useCallback(
    (state: boolean) => {
      if (state) {
        setIsError(false);
      }

      setIsCreating(state);
    },
    [setIsError, setIsCreating],
  );

  if (isCreating) {
    return (
      <LoadingEmptyStatusComponent
        emptyMessage=""
        isLoading
        loadingMessage={t('loading')}
      />
    );
  }

  if (selectedTemplate) {
    return (
      <SelectedTemplateStateWrapper
        onReset={() => {
          setSelectedTemplate(null);
        }}
        onErrored={() => {
          setIsCreating(false);
          setIsError(true);
        }}
        onCreating={handleCreating}
        selectedTemplate={selectedTemplate}
      />
    );
  }

  return (
    <VStack paddingTop="xsmall" paddingBottom>
      <DeployFromTemplate onSelectTemplate={setSelectedTemplate} />
      <FromStarterKit
        onError={() => {
          setIsCreating(false);
          setIsError(true);
        }}
        onIsCreating={handleCreating}
      />
    </VStack>
  );
}

export function DeployAgentDialog() {
  const [isCreating, setIsCreating] = React.useState(false);
  const [isError, setIsError] = React.useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    React.useState<SelectedTemplate | null>(null);
  const t = useTranslations(
    'projects/(projectSlug)/agents/page/DeployAgentDialog',
  );

  return (
    <Dialog
      color="background"
      title={t('title')}
      hideFooter
      disableForm
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setIsCreating(false);
          setIsError(false);
          setSelectedTemplate(null);
        }
      }}
      errorMessage={isError ? t('error') : undefined}
      size={selectedTemplate ? 'large' : 'xxlarge'}
      trigger={
        <Button
          data-testid="deploy-agent-dialog-start"
          label={t('trigger')}
          preIcon={<PlusIcon />}
          color="primary"
        />
      }
    >
      <div className="min-h-[60vh] h-full flex flex-col">
        <DeployAgentViewContents
          isCreating={isCreating}
          setIsCreating={setIsCreating}
          setIsError={setIsError}
          selectedTemplate={selectedTemplate}
          setSelectedTemplate={setSelectedTemplate}
        />
      </div>
    </Dialog>
  );
}
