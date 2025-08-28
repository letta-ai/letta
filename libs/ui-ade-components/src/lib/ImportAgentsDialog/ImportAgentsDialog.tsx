'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  UseAgentsServiceListAgentsKeyFn,
  useAgentsServiceImportAgentSerialized,
} from '@letta-cloud/sdk-core';
import type { AgentFileSchema } from '@letta-cloud/sdk-core';
import {
  Alert,
  Button,
  FormField,
  FormProvider,
  HStack,
  JSONViewer,
  LettaInvaderIcon,
  MiniApp,
  Switch,
  toast,
  Typography,
  useForm,
  VStack,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from '@letta-cloud/translations';
import { cn } from '@letta-cloud/ui-styles';
import { webApi } from '@letta-cloud/sdk-web';
import type { ProjectSelectorProjectType } from './ImportAgentFileProjectSelector/ImportAgentFileProjectSelector';
import {
  ImportAgentFileProjectSelector,
  ProjectSelectorProjectSchema,
} from './ImportAgentFileProjectSelector/ImportAgentFileProjectSelector';
import { useRouter, useSearchParams } from 'next/navigation';
import { environment } from '@letta-cloud/config-environment-variables';

interface ImportAgentsDialogProps {
  trigger: React.ReactNode;
  supportTemplateUploading?: boolean;
  defaultTemplateImport?: boolean;
  defaultProject?: ProjectSelectorProjectType;
  showProjectSelector?: boolean;
  onSuccess?: (redirectId: string, template?: boolean) => void;
  agentfileData?: AgentFileSchema;
}

interface AgentsDialogSidebarProps {
  isImporting: boolean;
  supportTemplateUploading?: boolean;
  onReset: () => void;
  secondaryButton?: React.ReactNode;
  showProjectSelector?: boolean;
}

function AgentsDialogSidebar(props: AgentsDialogSidebarProps) {
  const {
    isImporting,
    supportTemplateUploading = false,
    onReset,
    secondaryButton,
    showProjectSelector,
  } = props;
  const t = useTranslations('ImportAgentsDialog');

  return (
    <VStack
      paddingBottom
      borderLeft
      overflowY="auto"
      color="background"
      className="flex-1 largerThanMobile:max-w-[350px]"
    >
      <HStack padding="medium" borderBottom align="center">
        <LettaInvaderIcon />
        <Typography variant="body" bold>
          {t('title')}
        </Typography>
      </HStack>
      <VStack paddingX="medium">
        <Alert title={t('warning.title')} variant="warning">
          {t('warning.content')}
        </Alert>
        <VStack border padding="medium" gap="form">
          <Typography bold variant="body" align="left">
            {t('importOptions')}
          </Typography>
          {!!showProjectSelector && (
            <FormField
              render={({ field }) => {
                return (
                  <ImportAgentFileProjectSelector
                    value={field.value}
                    onSelectProject={field.onChange}
                    fullWidth
                  />
                );
              }}
              name="project"
            />
          )}

          <FormField
            render={({ field }) => (
              <Switch
                data-testid="append-copy-suffix-switch"
                fullWidth
                infoTooltip={{
                  text: t('AgentsDialogSidebar.appendCopySuffix.info'),
                }}
                label={t('AgentsDialogSidebar.appendCopySuffix.label')}
                onCheckedChange={field.onChange}
                checked={field.value}
              />
            )}
            name="appendCopySuffix"
          />
          <FormField
            render={({ field }) => (
              <Switch
                fullWidth
                infoTooltip={{
                  text: t('AgentsDialogSidebar.overrideExistingTools.info'),
                }}
                label={t('AgentsDialogSidebar.overrideExistingTools.label')}
                onCheckedChange={field.onChange}
                checked={field.value}
              />
            )}
            name="overrideExistingTools"
          />
          {supportTemplateUploading && (
            <FormField
              render={({ field }) => (
                <Switch
                  fullWidth
                  infoTooltip={{
                    text: t('AgentsDialogSidebar.importAsTemplate.info'),
                  }}
                  label={t('AgentsDialogSidebar.importAsTemplate.label')}
                  onCheckedChange={field.onChange}
                  checked={field.value}
                />
              )}
              name="importAsTemplate"
            />
          )}
        </VStack>
        <Button
          data-testid="import-button"
          color="primary"
          busy={isImporting}
          type="submit"
          fullWidth
          label={t('AgentsDialogSidebar.importButton')}
        />
        {secondaryButton ? (
          secondaryButton
        ) : (
          <Button
            color="tertiary"
            disabled={isImporting}
            onClick={onReset}
            type="button"
            fullWidth
            label={t('AgentsDialogSidebar.reset')}
          />
        )}
      </VStack>
    </VStack>
  );
}

export function ImportAgentsDialog(props: ImportAgentsDialogProps) {
  const {
    trigger,
    defaultProject,
    onSuccess,
    defaultTemplateImport = false,
    showProjectSelector = false,
    agentfileData,
  } = props;

  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { push } = useRouter();
  const searchParams = useSearchParams();
  const [forcePendingState, setForcePendingState] = useState<boolean>(false);

  const t = useTranslations('ImportAgentsDialog');

  const UploadToFormValuesSchema = useMemo(
    () =>
      z.object({
        file: z
          .custom<File>((v) => v instanceof File, {
            message: t('errors.fileIsRequired'),
          })
          .nullable(),
        project: showProjectSelector
          ? ProjectSelectorProjectSchema
          : ProjectSelectorProjectSchema.optional(),
        overrideExistingTools: z.boolean(),
        appendCopySuffix: z.boolean(),
        importAsTemplate: z.boolean().optional(),
      }),
    [t, showProjectSelector],
  );

  type UploadToFormValues = z.infer<typeof UploadToFormValuesSchema>;

  const {
    mutate: importAgent,
    reset: resetImportAgent,
    isPending: isImportAgentPending,
  } = useAgentsServiceImportAgentSerialized({
    onError: () => {
      toast.error(t('errors.failedToImport'));
    },
    onSuccess: async (res) => {
      // Get the selected project ID and find corresponding slug
      const selectedProject = form.getValues('project');

      if (selectedProject) {
        push(`/projects/${selectedProject.slug}/agents/${res.agent_ids[0]}`);
      }

      await queryClient.refetchQueries({
        queryKey: ['infinite', ...UseAgentsServiceListAgentsKeyFn()].slice(
          0,
          -1,
        ),
        exact: false,
      });

      if (onSuccess) {
        onSuccess(res.agent_ids[0], false);
      }

      if (!agentfileData) {
        handleDialogOpenChange(false);
      }

      setForcePendingState(true);

      toast.success('Import agent successful! Redirecting...');
    },
  });

  const {
    mutate: importTemplate,
    reset: resetImportTemplate,
    isPending: isImportTemplatePending,
  } = webApi.agentTemplates.importAgentFileAsTemplate.useMutation({
    onError: () => {
      toast.error(t('errors.failedToImport'));
    },
    onSuccess: async (res) => {
      handleDialogOpenChange(false);

      if (onSuccess) {
        onSuccess(res.body.name, true);
      }
    },
  });

  const form = useForm<UploadToFormValues>({
    resolver: zodResolver(UploadToFormValuesSchema),
    mode: 'onChange',
    defaultValues: {
      file: null,
      project: defaultProject,
      overrideExistingTools: false,
      appendCopySuffix: false,
      importAsTemplate: defaultTemplateImport,
    },
  });

  useEffect(() => {
    return () => {
      form.reset();
    };
  }, [form]);
  //

  const [draggedOver, setDraggedOver] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<Partial<AgentFileSchema> | null>(
    agentfileData || null,
  );
  const [fileReadError, setFileReadError] = useState<string | null>(null);

  const convertAgentDataToFile = useCallback(
    (agentData: AgentFileSchema): File => {
      const jsonString = JSON.stringify(agentData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const fileName = `agent.json`;
      return new File([blob], fileName, { type: 'application/json' });
    },
    [],
  );

  const onSubmit = useCallback(
    (values: UploadToFormValues) => {
      // Early return if no data source available
      if (!file && !agentfileData) {
        return;
      }

      // Determine the file to use (uploaded file or converted agent data)
      const fileToImport =
        file || (agentfileData ? convertAgentDataToFile(agentfileData) : null);

      if (!fileToImport) {
        return;
      }

      const selectedProjectId = values.project?.id || defaultProject?.id;

      // Handle template import
      if (values.importAsTemplate) {
        importTemplate({
          body: {
            file: fileToImport,
            append_copy_suffix: values.appendCopySuffix,
            override_existing_tools: values.overrideExistingTools,
            ...(selectedProjectId ? { project_id: selectedProjectId } : {}),
          },
        });
        return;
      }

      // Handle regular agent import
      importAgent({
        formData: {
          file: fileToImport,
          ...(selectedProjectId ? { project_id: selectedProjectId } : {}),
          append_copy_suffix: values.appendCopySuffix,
          override_existing_tools: values.overrideExistingTools,
        },
      });
    },
    [
      importAgent,
      file,
      importTemplate,
      defaultProject,
      agentfileData,
      convertAgentDataToFile,
    ],
  );

  useEffect(() => {
    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      setFileReadError(t('errors.failedToRead'));
      setFile(null);
    };

    reader.readAsText(file);

    reader.onload = (event) => {
      // get the file content

      const content = event.target?.result as string;

      try {
        setFileData(JSON.parse(content));
      } catch (_e) {
        setFile(null);
        setFileReadError(t('errors.invalidFile'));
      }
    };

    return () => {
      reader.abort();
    };
  }, [file, t]);

  const handleDropFile = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      setFile(file);
    },
    [],
  );

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleChooseFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      setFile(file);
    },
    [],
  );

  const handleReset = useCallback(() => {
    setFile(null);
    setFileData(null);
    setFileReadError(null);
    resetImportTemplate();
    if (fileInputRef.current?.value) {
      fileInputRef.current.value = '';
    }
    form.reset();
    resetImportAgent();
  }, [form, resetImportAgent, resetImportTemplate]);

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        handleReset();
      }

      setIsOpen(nextOpen);
    },
    [handleReset],
  );

  return (
    <FormProvider {...form}>
      <MiniApp
        trigger={trigger}
        isOpen={isOpen}
        onOpenChange={handleDialogOpenChange}
        appName={t('title')}
      >
        <form className="contents" onSubmit={form.handleSubmit(onSubmit)}>
          <HStack
            className="largerThanMobile:flex-row  flex-col"
            gap={false}
            fullWidth
            fullHeight
          >
            <input
              className="opacity-0 w-0 h-0 absolute"
              ref={fileInputRef}
              type="file"
              onChange={handleChooseFile}
            />
            <VStack
              className={
                'largerThanMobile:max-h-full  largerThanMobile:border-none border-b h-full max-h-[50%]'
              }
              flex
              collapseWidth
              color="background-grey"
            >
              {!fileData ? (
                <VStack
                  padding
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDraggedOver(true);
                  }}
                  onDragLeave={() => {
                    setDraggedOver(false);
                  }}
                  className={cn(
                    draggedOver && 'bg-background-grey2',
                    'transition-colors',
                  )}
                  onDrop={handleDropFile}
                  fullWidth
                  fullHeight
                  align="center"
                  justify="center"
                >
                  <LettaInvaderIcon
                    color={draggedOver ? 'brand' : 'default'}
                    size="xlarge"
                  />
                  <Typography variant="body" align="center">
                    {t('dropText')}
                  </Typography>
                  {fileReadError && (
                    <Typography
                      variant="body"
                      color="destructive"
                      align="center"
                    >
                      {fileReadError}
                    </Typography>
                  )}
                  <Button
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    color="secondary"
                    label={t('chooseFileText')}
                  />
                </VStack>
              ) : (
                <VStack fullHeight fullWidth overflow="auto" padding>
                  <JSONViewer data={fileData}></JSONViewer>
                </VStack>
              )}
            </VStack>
            {fileData && (
              <AgentsDialogSidebar
                supportTemplateUploading={false}
                onReset={handleReset}
                showProjectSelector={showProjectSelector}
                isImporting={
                  isImportAgentPending ||
                  isImportTemplatePending ||
                  forcePendingState
                }
                secondaryButton={
                  agentfileData && (
                    <Button
                      color="tertiary"
                      disabled={
                        isImportAgentPending ||
                        isImportTemplatePending ||
                        forcePendingState
                      }
                      onClick={() => {
                        const agentId = searchParams.get('import-agent');
                        push(
                          `${environment.NEXT_PUBLIC_AGENTFILES_SITE}/agents/${agentId}`,
                        );
                      }}
                      type="button"
                      fullWidth
                      label={t('AgentsDialogSidebar.backToAgentfileDirectory')}
                    />
                  )
                }
              />
            )}
          </HStack>
        </form>
      </MiniApp>
    </FormProvider>
  );
}
