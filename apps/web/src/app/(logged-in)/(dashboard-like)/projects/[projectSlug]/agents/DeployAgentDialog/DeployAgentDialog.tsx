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
  RawInput,
  Section,
  Typography,
  VStack,
} from '@letta-web/component-library';
import { useTranslations } from '@letta-cloud/translations';
import { StarterKitItems } from '$web/client/components';
import { useCurrentProject } from '../../hooks';
import {
  STARTER_KITS,
  webApi,
  webApiQueryKeys,
  webOriginSDKApi,
} from '$web/client';
import { useRouter } from 'next/navigation';
import { useAgentsServiceGetAgent } from '@letta-web/letta-agents-api';
import { findMemoryBlockVariables } from '@letta-web/generic-utils';

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
                .map((template) => (
                  <Card
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

  const { id: projectId, slug } = useCurrentProject();

  const starterKits = useMemo(() => {
    return Object.entries(STARTER_KITS);
  }, []);

  const { push } = useRouter();

  const { mutate } = webOriginSDKApi.agents.createAgent.useMutation({
    onError: () => {
      onIsCreating(false);
      onError();
    },
    onSuccess: (data) => {
      push(`/projects/${slug}/agents/${data.body.id}`);
    },
  });

  const handleSelectStarterKit = useCallback(
    (starterKitId: string) => {
      onIsCreating(true);

      mutate({
        body: {
          template: false,
          from_template: starterKitId,
          project_id: projectId,
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

interface SelectedTemplateStateProps {
  selectedTemplate: SelectedTemplate;
  onReset: () => void;
  onCreating: (isCreating: boolean) => void;
  onErrored: () => void;
}

function SelectedTemplateState(props: SelectedTemplateStateProps) {
  const { selectedTemplate, onReset, onCreating, onErrored } = props;
  const t = useTranslations(
    'projects/(projectSlug)/agents/page/DeployAgentDialog',
  );
  const { push } = useRouter();
  const { slug: projectSlug } = useCurrentProject();

  const {
    mutate: createAgent,
    isSuccess,
    isPending,
  } = webOriginSDKApi.agents.createAgent.useMutation({
    onError: onErrored,
    onSuccess: (data) => {
      push(`/projects/${projectSlug}/agents/${data.body.id}`);
    },
  });

  const [variablesForm, setVariablesForm] = React.useState<
    Record<string, string>
  >({});

  const handleCreateAgent = useCallback(() => {
    onCreating(true);

    if (isSuccess || isPending) {
      return;
    }

    createAgent({
      body: {
        variables: variablesForm,
        from_template: selectedTemplate.version,
      },
    });
  }, [
    createAgent,
    isPending,
    isSuccess,
    onCreating,
    selectedTemplate.version,
    variablesForm,
  ]);

  const { data: agent } = useAgentsServiceGetAgent({
    agentId: selectedTemplate.id,
  });

  const variablesInTemplate = useMemo(() => {
    if (!agent) {
      return null;
    }

    return findMemoryBlockVariables(agent);
  }, [agent]);

  useEffect(() => {
    if (isPending || isSuccess) {
      return;
    }

    if (!variablesInTemplate) {
      return;
    }

    if (variablesInTemplate.length === 0) {
      handleCreateAgent();
    }
  }, [handleCreateAgent, isPending, isSuccess, variablesInTemplate]);

  if (!variablesInTemplate) {
    return (
      <LoadingEmptyStatusComponent
        emptyMessage=""
        isLoading
        loadingMessage={t('SelectedTemplateState.readying')}
      />
    );
  }

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
            <VStack flex fullHeight gap="form">
              <VStack fullHeight flex>
                {variablesInTemplate.map((variable) => (
                  <HStack border fullWidth align="center" key={variable}>
                    <HStack paddingX="small" fullWidth borderRight>
                      <Typography align="left" bold>
                        {variable}
                      </Typography>
                    </HStack>
                    <RawInput
                      placeholder={t('SelectedTemplateState.inputPlaceholder')}
                      fullWidth
                      color="transparent"
                      label={t('SelectedTemplateState.inputLabel', {
                        variable,
                      })}
                      onChange={(e) => {
                        setVariablesForm({
                          ...variablesForm,
                          [variable]: e.target.value,
                        });
                      }}
                      hideLabel
                    />
                  </HStack>
                ))}
              </VStack>
              <FormActions>
                <Button
                  type="button"
                  onClick={onReset}
                  label={t('SelectedTemplateState.return')}
                  color="tertiary"
                />
                <Button
                  type="submit"
                  label={t('SelectedTemplateState.create')}
                  preIcon={<PlusIcon />}
                  color="secondary"
                />
              </FormActions>
            </VStack>
          </Form>
        </VStack>
      </Section>
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

  const handleCreating = useCallback((state: boolean) => {
    if (state) {
      setIsError(false);
    }

    setIsCreating(state);
  }, []);

  const view = useMemo(() => {
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
        <SelectedTemplateState
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
  }, [handleCreating, isCreating, selectedTemplate, t]);

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
        <Button label={t('trigger')} preIcon={<PlusIcon />} color="secondary" />
      }
    >
      <div className="min-h-[60vh] h-full flex flex-col">{view}</div>
    </Dialog>
  );
}
