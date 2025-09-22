import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import type { KeyValue } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { webApi } from '$web/client';
import { useRouter } from 'next/navigation';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import {
  cloudAPI,
  cloudQueryKeys,
  type PublicTemplateDetailsType,
} from '@letta-cloud/sdk-cloud-api';
import { StarterKitSelector } from '@letta-cloud/ui-ade-components';
import { isFetchError } from '@ts-rest/react-query/v5';
import { BillingLink } from '@letta-cloud/ui-component-library';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';
import { GoingToADEView } from '$web/client/components/GoingToADEView/GoingToADEView';

const elementWidth = '204px';
const elementHeight = '166px';

interface DeployFromTemplateProps {
  onSelectTemplate: (template: PublicTemplateDetailsType) => void;
}

function DeployFromTemplate(props: DeployFromTemplateProps) {
  const { onSelectTemplate } = props;
  const t = useTranslations(
    'projects/(projectSlug)/agents/page/DeployAgentDialog',
  );
  const { id: currentProjectId } = useCurrentProject();

  const [search, setSearch] = React.useState('');

  const { data } = cloudAPI.templates.listTemplates.useQuery({
    queryKey: cloudQueryKeys.templates.listTemplatesProjectScopedWithSearch(
      currentProjectId,
      {
        search,
        limit: 4,
        offset: 0,
      },
    ),
    queryData: {
      query: {
        search,
        offset: '0',
        project_id: currentProjectId,
        limit: '4',
      },
    },
  });

  const templates = useMemo(() => {
    if (!data) {
      return null;
    }

    return data?.body.templates || [];
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
            ? templates.map((template, index) => (
                <Card
                  testId={`deploy-from-template-card:${index}`}
                  onClick={() => {
                    if (template.id) {
                      onSelectTemplate(template);
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
                          version: template.latest_version || '1',
                        })}
                      />
                    </HStack>
                  </VStack>
                </Card>
              ))
            : Array.from({ length: 4 }, (_, index) => (
                <ActionCard title="" key={index} isSkeleton />
              ))}
        </NiceGridDisplay>
      )}
    </Section>
  );
}

interface FromStarterKitProps {
  onIsCreating: (isCreating: boolean) => void;
  onError: (error: ErrorType) => void;
}

function FromStarterKit(props: FromStarterKitProps) {
  const { onIsCreating, onError } = props;
  const t = useTranslations(
    'projects/(projectSlug)/agents/page/DeployAgentDialog',
  );

  const { slug, id: projectId } = useCurrentProject();

  const { push } = useRouter();

  const { mutate } = webApi.starterKits.createAgentFromStarterKit.useMutation({
    onError: (error) => {
      if (!isFetchError(error) && error.status === 402) {
        onError('overage');
      } else {
        onError('default');
      }

      onIsCreating(false);
    },
    onSuccess: (data) => {
      push(`/projects/${slug}/agents/${data.body.agentId}`);
    },
  });

  const handleSelectStarterKit = useCallback(
    (starterKitId: string) => {
      onIsCreating(true);

      trackClientSideEvent(AnalyticsEvent.CREATE_AGENT, {
        origin: 'starter_kit:deploy_agent_dialog',
        starter_kit_id: starterKitId,
      });

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
      <StarterKitSelector
        architectures={['memgpt', 'sleeptime']}
        onSelectStarterKit={(_, kit) => {
          handleSelectStarterKit(kit.id);
        }}
      />
    </Section>
  );
}

interface SelectedTemplateStateWrapperProps {
  selectedTemplate: PublicTemplateDetailsType;
  onReset: () => void;
  onCreating: (isCreating: boolean) => void;
  onErrored: (error: ErrorType) => void;
  hasErrored?: boolean;
}

function SelectedTemplateStateWrapper(
  props: SelectedTemplateStateWrapperProps,
) {
  const { selectedTemplate, hasErrored, onReset, onCreating, onErrored } =
    props;

  const [project, templateVersion] =
    selectedTemplate.template_deployment_slug.split('/');

  const { data, isError } = cloudAPI.templates.getTemplateSnapshot.useQuery({
    queryKey: cloudQueryKeys.templates.getTemplateSnapshot(
      project,
      templateVersion,
    ),
    queryData: {
      params: {
        project,
        template_version: templateVersion,
      },
    },
  });

  const t = useTranslations(
    'projects/(projectSlug)/agents/page/DeployAgentDialog',
  );

  const memoryVariablesInTemplate = useMemo(() => {
    if (!data) {
      return null;
    }

    if (!data.body.agents[0]) {
      return [];
    }

    return (
      data.body.agents[0].memoryVariables?.data?.map((item) => item.key) || []
    );
  }, [data]);

  const toolVariablesInTemplate = useMemo(() => {
    if (!data) {
      return [];
    }

    if (!data.body.agents[0]) {
      return [];
    }

    return (
      data.body.agents[0].toolVariables?.data?.map((item) => item.key) || []
    );
  }, [data]);

  if (!data || isError) {
    return (
      <LoadingEmptyStatusComponent
        emptyMessage=""
        errorMessage={isError ? t('SelectedTemplateState.error') : ''}
        isError={isError}
        isLoading
        loadingMessage={t('SelectedTemplateState.readying')}
      />
    );
  }

  if (data.body.type !== 'classic') {
    return (
      <LoadingEmptyStatusComponent
        emptyMessage=""
        isError
        errorMessage={t('SelectedTemplateState.errorUnsupported')}
      />
    );
  }

  return (
    <SelectedTemplateState
      selectedTemplate={selectedTemplate}
      onReset={onReset}
      hasErrored={hasErrored}
      onCreating={onCreating}
      onErrored={onErrored}
      memoryVariablesInTemplate={memoryVariablesInTemplate || []}
      toolVariablesInTemplate={toolVariablesInTemplate || []}
    />
  );
}

interface SelectedTemplateStateProps extends SelectedTemplateStateWrapperProps {
  memoryVariablesInTemplate: string[];
  toolVariablesInTemplate: string[];
}

function SelectedTemplateState(props: SelectedTemplateStateProps) {
  const {
    selectedTemplate,
    memoryVariablesInTemplate,
    toolVariablesInTemplate,
    onReset,
    hasErrored,
    onCreating,
    onErrored,
  } = props;
  const t = useTranslations(
    'projects/(projectSlug)/agents/page/DeployAgentDialog',
  );
  const { push } = useRouter();
  const { slug: projectSlug } = useCurrentProject();

  const attemptedAutoCreate = useRef<boolean>(false);
  const {
    mutate: createAgent,
    isSuccess,
    isPending,
  } = cloudAPI.templates.createAgentsFromTemplate.useMutation({
    onError: (error) => {
      if (!isFetchError(error) && error.status === 402) {
        onErrored('overage');
      } else {
        onErrored('default');
      }

      onCreating(false);
    },
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
        template_version: `${selectedTemplate.name}:${selectedTemplate.latest_version}`,
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
    onCreating,
    isSuccess,
    isPending,
    projectSlug,
    selectedTemplate.name,
    selectedTemplate.latest_version,
    memoryVariables,
    toolVariables,
  ]);

  const hasNoVariables = useMemo(() => {
    return (
      memoryVariablesInTemplate.length === 0 &&
      toolVariablesInTemplate.length === 0
    );
  }, [memoryVariablesInTemplate, toolVariablesInTemplate.length]);
  useEffect(() => {
    if (isPending || isSuccess) {
      return;
    }

    if (attemptedAutoCreate.current) {
      return;
    }

    if (!memoryVariablesInTemplate) {
      return;
    }

    if (hasErrored) {
      return;
    }

    if (
      memoryVariablesInTemplate.length === 0 &&
      toolVariablesInTemplate.length === 0
    ) {
      attemptedAutoCreate.current = true;
      handleCreateAgent();
    }
  }, [
    handleCreateAgent,
    isPending,
    hasErrored,
    isSuccess,
    memoryVariablesInTemplate,
    toolVariablesInTemplate.length,
  ]);

  return (
    <VStack fullHeight flex>
      <VStack paddingBottom flex fullHeight>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateAgent();
          }}
        >
          {!hasNoVariables && (
            <Section
              fullHeight
              title={t('SelectedTemplateState.title')}
              description={t('SelectedTemplateState.description')}
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
              </VStack>
            </Section>
          )}
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
        </Form>
      </VStack>
    </VStack>
  );
}

interface DeployAgentViewContentsProps {
  isCreating: boolean;
  setIsCreating: (isCreating: boolean) => void;
  setIsError: (isError: ErrorType | null) => void;
  hasErrored?: boolean;
  selectedTemplate: PublicTemplateDetailsType | null;
  setSelectedTemplate: (template: PublicTemplateDetailsType | null) => void;
}

function DeployAgentViewContents(props: DeployAgentViewContentsProps) {
  const {
    setIsCreating,
    setIsError,
    hasErrored = false,
    selectedTemplate,
    setSelectedTemplate,
  } = props;

  const handleCreating = useCallback(
    (state: boolean) => {
      if (state) {
        setIsError(null);
      }

      setIsCreating(state);
    },
    [setIsError, setIsCreating],
  );

  if (selectedTemplate) {
    return (
      <SelectedTemplateStateWrapper
        onReset={() => {
          setIsError(null);
          setSelectedTemplate(null);
        }}
        hasErrored={hasErrored}
        onErrored={(error) => {
          setIsCreating(false);

          setIsError(error);
        }}
        onCreating={handleCreating}
        selectedTemplate={selectedTemplate}
      />
    );
  }

  return (
    <VStack paddingTop="xsmall" paddingBottom>
      <FromStarterKit
        onError={(error) => {
          setIsCreating(false);
          setIsError(error);
        }}
        onIsCreating={handleCreating}
      />
      <DeployFromTemplate onSelectTemplate={setSelectedTemplate} />
    </VStack>
  );
}

type ErrorType = 'default' | 'overage';

interface DeployAgentDialogProps {
  trigger?: React.ReactNode;
}

export function DeployAgentDialog(props: DeployAgentDialogProps) {
  const { trigger } = props;
  const [isCreating, setIsCreating] = React.useState(false);
  const [errorType, setErrorType] = React.useState<ErrorType | null>(null);
  const [selectedTemplate, setSelectedTemplate] =
    React.useState<PublicTemplateDetailsType | null>(null);
  const t = useTranslations(
    'projects/(projectSlug)/agents/page/DeployAgentDialog',
  );

  const [canCreateAgents] = useUserHasPermission(
    ApplicationServices.CREATE_AGENT,
  );

  const errorMessage = useMemo(() => {
    if (errorType) {
      if (errorType === 'overage') {
        return t.rich('error.overage', {
          link: (chunks) => <BillingLink>{chunks}</BillingLink>,
        });
      }

      return t('error.default');
    }

    return null;
  }, [errorType, t]);

  if (!canCreateAgents) {
    return null;
  }

  return (
    <Dialog
      color="background"
      title={t('title')}
      hideFooter
      disableForm
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setIsCreating(false);
          setErrorType(null);
          setSelectedTemplate(null);
        }
      }}
      errorMessage={errorMessage || ''}
      size={selectedTemplate ? 'large' : 'xxlarge'}
      trigger={
        trigger || (
          <Button
            data-testid="deploy-agent-dialog-start"
            label={t('trigger')}
            preIcon={<PlusIcon />}
            color="primary"
          />
        )
      }
    >
      {isCreating && <GoingToADEView mode="agent" />}
      <div className="h-full flex flex-col">
        <DeployAgentViewContents
          isCreating={isCreating}
          setIsCreating={setIsCreating}
          hasErrored={!!errorType}
          setIsError={setErrorType}
          selectedTemplate={selectedTemplate}
          setSelectedTemplate={setSelectedTemplate}
        />
      </div>
    </Dialog>
  );
}
