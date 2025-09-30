import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  Checkbox,
  CloseIcon,
  CloseMiniApp,
  ExternalLink,
  FormField,
  FormProvider,
  HStack,
  MiniApp,
  TextArea,
  Typography,
  useForm,
  VStack,
  HiddenOnMobile,
  VisibleOnMobile,
  Alert,
} from '@letta-cloud/ui-component-library';

import { z } from 'zod';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';

import { useUserHasPermission } from '$web/client/hooks';

import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';
import { ApplicationServices } from '@letta-cloud/service-rbac';
import { CompareTemplateVersions } from '$web/client/components';
import { CloudUpsellDeploy } from '$web/client/components/ADEPage/DeploymentButton/CloudUpsellButton/CloudUpsellButton';
import { CreateTemplateButton } from '$web/client/components/ADEPage/DeploymentButton/CreateTemplateFromAgentButton/CreateTemplateFromAgentButton';
import { cloudAPI } from '@letta-cloud/sdk-cloud-api';
import { useCurrentTemplateName } from '$web/client/hooks/useCurrentTemplateName/useCurrentTemplateName';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { webApi } from '@letta-cloud/sdk-web';
import { useFormContext } from 'react-hook-form';

interface CreateNewTemplateVersionDialogProps {
  trigger: React.ReactNode;
}

interface FormFieldsProps {
  isPending: boolean;
  isError: boolean;
}

function FormFields(props: FormFieldsProps) {
  const { isPending, isError } = props;

  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  const {  watch, setValue } = useFormContext();

  const isMigrateChecked = watch('migrate');

  useEffect(() => {
    // if migrate is unchecked, set overwriteToolVariables to false
    if (!isMigrateChecked) {
      setValue('overwriteToolVariables', false);
    }
  }, [isMigrateChecked, setValue]);

  return (
    <VStack fullHeight padding>
      <VStack fullWidth fullHeight paddingBottom gap="xlarge">
        <FormField
          render={({ field }) => {
            return (
              <TextArea
                {...field}
                autosize
                minRows={4}
                rows={3}
                fullWidth
                label={t('VersionAgentDialog.message.label')}
                placeholder={t('VersionAgentDialog.message.placeholder')}
              />
            );
          }}
          name="message"
        />
        <FormField
          render={({ field }) => {
            return (
              <Checkbox
                data-testid="version-agent-dialog-migrate-checkbox"
                size="large"
                checked={field.value}
                description={t.rich('VersionAgentDialog.migrateDescription', {
                  link: (chunks) => (
                    <ExternalLink href="https://docs.letta.com/api-reference/agents/migrate-agent">
                      {chunks}
                    </ExternalLink>
                  ),
                })}
                label={t('VersionAgentDialog.migrate')}
                onCheckedChange={(value) => {
                  field.onChange({
                    target: {
                      value: value,
                      name: field.name,
                    },
                  });
                }}
              />
            );
          }}
          name="migrate"
        />
        <FormField
          render={({ field }) => {
            return (
              <Checkbox
                data-testid="version-agent-dialog-overwrite-tool-variables-checkbox"
                size="large"
                disabled={!isMigrateChecked}
                checked={field.value}
                description={t(
                  'VersionAgentDialog.overwriteToolVariablesDescription',
                )}
                label={t('VersionAgentDialog.overwriteToolVariables')}
                onCheckedChange={(value) => {
                  field.onChange({
                    target: {
                      value: value,
                      name: field.name,
                    },
                  });
                }}
              />
            );
          }}
          name="overwriteToolVariables"
        />
      </VStack>
      {isError && (
        <Alert
          title={t('VersionAgentDialog.error.title')}
          variant={'destructive'}
        />
      )}
      <Button
        data-testid="deploy-agent-dialog-trigger"
        color="primary"
        fullWidth
        bold
        size="large"
        busy={isPending}
        label={t('VersionAgentDialog.confirm')}
      />
    </VStack>
  );
}

function CreateNewTemplateVersionDialog(
  props: CreateNewTemplateVersionDialogProps,
) {
  const { trigger } = props;
  const { slug } = useCurrentProject();

  const { templateId: agentTemplateId } = useCurrentAgentMetaData();
  const [open, setOpen] = useState(false);
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  const versionAgentFormSchema = useMemo(
    () =>
      z.object({
        migrate: z.boolean(),
        overwriteToolVariables: z.boolean(),
        message: z.string().max(140, {
          message: t('VersionAgentDialog.message.maxChars'),
        }),
      }),
    [t],
  );

  const templateName = useCurrentTemplateName();

  type VersionAgentFormValues = z.infer<typeof versionAgentFormSchema>;

  const form = useForm<VersionAgentFormValues>({
    resolver: zodResolver(versionAgentFormSchema),
    defaultValues: {
      migrate: false,
      overwriteToolVariables: false,
      message: '',
    },
  });
  const {
    mutate: saveTemplateVersion,
    isPending: isSaving,
    isError: savingError,
    isSuccess,
  } = cloudAPI.templates.saveTemplateVersion.useMutation({
    onSuccess: () => {
      window.location.href = `/projects/${slug}/templates/${templateName}/distribution`;
    },
  });

  const {
    isError: syncError,
    mutate: syncDefaultSimulatedAgent,
    isPending: isSyncing,
  } = webApi.simulatedAgents.syncDefaultSimulatedAgent.useMutation();

  const isPending = useMemo(() => {
    return isSaving || isSyncing;
  }, [isSaving, isSyncing]);

  const handleVersionNewAgent = useCallback(
    (values: VersionAgentFormValues) => {
      syncDefaultSimulatedAgent(
        {
          params: {
            agentTemplateId: agentTemplateId || '',
          },
        },
        {
          onSuccess: () => {
            saveTemplateVersion({
              body: {
                migrate_agents: values.migrate,
                preserve_environment_variables_on_migration:
                  !values.overwriteToolVariables,
                message: values.message,
              },
              params: {
                project_id: slug,
                template_name: templateName,
              },
            });
          },
        },
      );
    },
    [
      saveTemplateVersion,
      agentTemplateId,
      syncDefaultSimulatedAgent,
      slug,
      templateName,
    ],
  );

  const isError = useMemo(() => {
    return syncError || savingError;
  }, [syncError, savingError]);

  return (
    <FormProvider {...form}>
      <MiniApp
        appName={t('VersionAgentDialog.title')}
        onOpenChange={setOpen}
        isOpen={open}
        backdrop
        __use__rarely__className="widescreen:max-w-[1440px]"
        trigger={trigger}
      >
        <form
          className="contents"
          onSubmit={form.handleSubmit(handleVersionNewAgent)}
        >
          <VStack overflow="hidden" fullHeight gap={false}>
            <HStack
              color="background-grey2"
              height="header"
              align="center"
              justify="spaceBetween"
              paddingX
              fullWidth
            >
              <HStack>
                <Typography bold>{t('VersionAgentDialog.title')}</Typography>
              </HStack>
              <CloseMiniApp data-testid="close-advanced-core-memory-editor">
                <HStack>
                  <CloseIcon />
                </HStack>
              </CloseMiniApp>
            </HStack>
            <HiddenOnMobile checkWithJs>
              <HStack fullWidth fullHeight gap={false} overflow="hidden">
                <VStack fullWidth fullHeight flex overflow="hidden">
                  <VStack
                    padding
                    fullWidth
                    collapseHeight
                    flex
                    overflowY="auto"
                  >
                    <CompareTemplateVersions
                      leftNameOverride={t(
                        'VersionAgentDialog.leftNameOverride',
                      )}
                      rightNameOverride={t(
                        'VersionAgentDialog.rightNameOverride',
                      )}
                      leftComparisonVersion="latest"
                      rightComparisonVersion="current"
                    />
                  </VStack>
                </VStack>
                <VStack
                  /* eslint-disable-next-line react/forbid-component-props */
                  className="max-w-[400px] w-[400px]"
                  borderLeft
                  fullHeight
                >
                  <FormFields
                    isPending={isPending || isSuccess}
                    isError={isError}
                  />
                </VStack>
              </HStack>
            </HiddenOnMobile>
            <VisibleOnMobile checkWithJs>
              <VStack fullWidth collapseHeight flex>
                <VStack collapseHeight flex overflowY="auto" padding="small">
                  <CompareTemplateVersions
                    leftNameOverride={t('VersionAgentDialog.leftNameOverride')}
                    rightNameOverride={t(
                      'VersionAgentDialog.rightNameOverride',
                    )}
                    leftComparisonVersion="latest"
                    rightComparisonVersion="current"
                  />
                </VStack>
                <VStack>
                  {isError && (
                    <Alert title={t('VersionAgentDialog.error.title')} />
                  )}
                  <FormFields
                    isPending={isPending || isSuccess}
                    isError={isError}
                  />
                </VStack>
              </VStack>
            </VisibleOnMobile>
          </VStack>
        </form>
      </MiniApp>
    </FormProvider>
  );
}

function TemplateVersionDisplay() {
  // get latest template version
  const t = useTranslations(
    'projects/(projectSlug)/agents/(agentId)/AgentPage',
  );

  const [canUpdateTemplate] = useUserHasPermission(
    ApplicationServices.CREATE_UPDATE_DELETE_TEMPLATES,
  );

  if (!canUpdateTemplate) {
    return null;
  }

  return (
    <CreateNewTemplateVersionDialog
      trigger={
        <Button
          size="default"
          data-testid="stage-new-version-button"
          color="primary"
          fullWidth
          label={t('DeploymentButton.save')}
        />
      }
    />
  );
}

export function DeploymentButton() {
  const { isLocal, isTemplate, isFromTemplate } = useCurrentAgentMetaData();

  if (isLocal) {
    return <CloudUpsellDeploy />;
  }

  if (isTemplate) {
    return <TemplateVersionDisplay />;
  }

  if (!isFromTemplate) {
    return <CreateTemplateButton />;
  }

  return null;
}
