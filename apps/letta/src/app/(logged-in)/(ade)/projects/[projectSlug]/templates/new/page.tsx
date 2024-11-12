'use client';
import React, { useCallback, useMemo } from 'react';
import {
  Badge,
  FormActions,
  Input,
  OptionTypeSchemaSingle,
} from '@letta-web/component-library';
import {
  ADEPage,
  Button,
  HStack,
  LettaLoader,
  AsyncSelect,
  Typography,
  VStack,
  Alert,
  isMultiValue,
  useForm,
  Form,
  FormProvider,
  FormField,
  RawSelect,
} from '@letta-web/component-library';
import { useCurrentProject } from '../../../../../(dashboard-like)/projects/[projectSlug]/hooks';
import { webApi, webApiQueryKeys, webOriginSDKApi } from '$letta/client';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AgentRecipeVariant } from '$letta/types';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ADEHeader } from '$letta/client/components';

function useDefaultAgentTemplate() {
  const t = useTranslations('projects/(projectSlug)/templates/new/page');

  return {
    value: AgentRecipeVariant.NO_TEMPLATE,
    label: t('useDefaultAgentTemplate.label'),
    description: t('useDefaultAgentTemplate.description'),
  };
}

function FromLettaBadge() {
  const t = useTranslations('projects/(projectSlug)/templates/new/page');

  return <Badge size="small" color="primary" content={t('FromLettaBadge')} />;
}

function usePreMadeAgentTemplates() {
  const defaultValue = useDefaultAgentTemplate();
  const t = useTranslations('projects/(projectSlug)/templates/new/page');

  return [
    {
      value: AgentRecipeVariant.CUSTOMER_SUPPORT,
      label: t('usePreMadeAgentTemplates.customerSupport.label'),
      badge: <FromLettaBadge />,
      description: t('usePreMadeAgentTemplates.customerSupport.description'),
    },
    {
      value: AgentRecipeVariant.FANTASY_ROLEPLAY,
      badge: <FromLettaBadge />,
      label: t('usePreMadeAgentTemplates.fantasyRoleplay.label'),
      description: t('usePreMadeAgentTemplates.fantasyRoleplay.description'),
    },
    defaultValue,
  ];
}

function PreExistingTemplateDropdown() {
  const t = useTranslations('projects/(projectSlug)/templates/new/page');
  const premadeAgentTemplates = usePreMadeAgentTemplates();
  const defaultValue = useDefaultAgentTemplate();

  const { data, isPending, isError } =
    webApi.agentTemplates.listAgentTemplates.useQuery({
      queryKey: webApiQueryKeys.agentTemplates.listAgentTemplatesWithSearch({
        limit: 10,
      }),
      queryData: {
        query: {
          limit: 10,
        },
      },
    });

  const handleLoadAgentTemplates = useCallback(
    async (search: string) => {
      const response = await webApi.agentTemplates.listAgentTemplates.query({
        query: {
          search,
          limit: 10,
        },
      });

      if (response.status !== 200) {
        throw new Error('Failed to load agent templates');
      }

      const res = response.body.agentTemplates.map((template) => ({
        label: template.name,
        value: template.name,
      }));

      res.unshift(...premadeAgentTemplates);

      return res;
    },
    [premadeAgentTemplates]
  );

  const agentTemplates = useMemo(() => {
    if (!data?.body) {
      return null;
    }

    const res = data.body.agentTemplates.map((template) => ({
      label: template.name,
      value: template.name,
    }));

    res.unshift(...premadeAgentTemplates);

    return res;
  }, [data?.body, premadeAgentTemplates]);

  if (isError) {
    return (
      <Alert
        title={t('PreExistingTemplateDropdown.error')}
        variant="destructive"
      />
    );
  }

  if (!agentTemplates) {
    return (
      <RawSelect
        value={defaultValue}
        placeholder={t('PreExistingTemplateDropdown.placeholder')}
        options={[]}
        isLoading={isPending}
        label={t('PreExistingTemplateDropdown.label')}
      />
    );
  }

  return (
    <>
      <FormField
        name="fromTemplate"
        render={({ field }) => (
          <AsyncSelect
            styleConfig={{
              menuWidth: 400,
            }}
            data-testid="pre-existing-template-dropdown"
            label={t('PreExistingTemplateDropdown.label')}
            loadOptions={handleLoadAgentTemplates}
            placeholder={t('PreExistingTemplateDropdown.placeholder')}
            value={field.value}
            onSelect={(value) => {
              if (isMultiValue(value)) {
                return;
              }

              field.onChange(value);
            }}
            defaultOptions={agentTemplates}
          />
        )}
      />
    </>
  );
}

const createAgentFormSchema = z.object({
  name: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, {
      message: 'Name must be alphanumeric and contain underscores or dashes',
    })
    .min(3)
    .max(50),
  fromTemplate: OptionTypeSchemaSingle,
});

type CreateAgentForm = z.infer<typeof createAgentFormSchema>;

function CreateAgentsView() {
  const defaultValue = useDefaultAgentTemplate();
  const { slug: projectSlug, id: projectId } = useCurrentProject();
  const queryClient = useQueryClient();
  const { push } = useRouter();

  const t = useTranslations('projects/(projectSlug)/templates/new/page');

  const form = useForm<CreateAgentForm>({
    resolver: zodResolver(createAgentFormSchema),
    defaultValues: {
      name: '',
      fromTemplate: defaultValue,
    },
  });

  const {
    mutate: createAgentTemplate,
    isPending,
    isError,
    isSuccess,
  } = webOriginSDKApi.agents.createAgent.useMutation({
    onSuccess: (response) => {
      void queryClient.invalidateQueries({
        queryKey: webApiQueryKeys.agentTemplates.listAgentTemplates,
      });

      push(`/projects/${projectSlug}/templates/${response.body.name}`);
    },
  });

  const handleCreateAgent = useCallback(
    (values: CreateAgentForm) => {
      const fromTemplateValue = values.fromTemplate.value;

      createAgentTemplate({
        body: {
          name: values.name,
          template: true,
          project_id: projectId,
          from_template: fromTemplateValue,
        },
      });
    },
    [createAgentTemplate, projectId]
  );

  if (isPending || isSuccess) {
    return (
      <VStack
        gap="large"
        paddingY
        align="center"
        justify="center"
        fullWidth
        fullHeight
      >
        <LettaLoader size="large" />
        Creating template...
      </VStack>
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={form.handleSubmit(handleCreateAgent)}>
        <VStack gap={false} fullWidth align="start" justify="center">
          {isError && (
            <HStack justify="start">
              <Alert title={t('error')} variant="destructive" />
            </HStack>
          )}

          <Typography bold variant="heading3">
            {t('title')}
          </Typography>
          <Typography variant="body">{t('description')}</Typography>
          <VStack gap="form" fullWidth paddingTop paddingBottom align="start">
            <PreExistingTemplateDropdown />
            <FormField
              name="name"
              render={({ field }) => (
                <Input
                  fullWidth
                  data-testid="agent-name-input"
                  label={t('nameInput.label')}
                  placeholder={t('nameInput.placeholder')}
                  {...field}
                />
              )}
            />
          </VStack>
          <HStack fullWidth borderTop paddingTop>
            <FormActions>
              <Button
                fullWidth
                data-testid="create-agent-button"
                type="submit"
                label={t('createButton')}
                color="primary"
                disabled={isPending}
              />
            </FormActions>
          </HStack>
        </VStack>
      </Form>
    </FormProvider>
  );
}

function NewAgentPage() {
  const { slug: projectSlug, name } = useCurrentProject();
  const t = useTranslations('projects/(projectSlug)/templates/new/page');

  return (
    <ADEPage
      header={
        <ADEHeader
          agent={{ name: t('pageTitle') }}
          project={{
            url: `/projects/${projectSlug}`,
            name: name,
          }}
        ></ADEHeader>
      }
    >
      <VStack paddingY fullHeight fullWidth align="center">
        <HStack
          width="contained"
          align="center"
          justify="center"
          fullWidth
          padding="xlarge"
          color="background"
        >
          <CreateAgentsView />
        </HStack>
      </VStack>
    </ADEPage>
  );
}

export default NewAgentPage;
