'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  UseAgentsServiceListAgentsKeyFn,
  useAgentsServiceImportAgentSerialized,
  zodTypes,
} from '@letta-cloud/sdk-core';
import type {
  AgentSchema,
  ToolSchema,
  MessageSchema,
} from '@letta-cloud/sdk-core';
import {
  Alert,
  ArrowLeftIcon,
  Button,
  Dialog,
  EyeOpenIcon,
  FormField,
  FormProvider,
  HStack,
  InfoTooltip,
  LettaInvaderIcon,
  MiniApp,
  RawCodeEditor,
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

interface ImportAgentsDialogProps {
  trigger: React.ReactNode;
  supportTemplateUploading?: boolean;
  defaultTemplateImport?: boolean;
  projectId?: string;
  onSuccess?: (redirectId: string, template?: boolean) => void;
}

interface AgentsDialogSidebarProps {
  isImporting: boolean;
  supportTemplateUploading: boolean;
  onReset: () => void;
}

function AgentsDialogSidebar(props: AgentsDialogSidebarProps) {
  const { isImporting, supportTemplateUploading, onReset } = props;
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
          <FormField
            render={({ field }) => (
              <Switch
                fullWidth
                infoTooltip={{
                  text: t('AgentsDialogSidebar.appendCopySuffix.info'),
                }}
                labelVariant="simple"
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
                labelVariant="simple"
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
                  labelVariant="simple"
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
          color="primary"
          busy={isImporting}
          type="submit"
          fullWidth
          label={t('AgentsDialogSidebar.importButton')}
        />
        <Button
          color="tertiary"
          disabled={isImporting}
          onClick={onReset}
          type="button"
          fullWidth
          label={t('AgentsDialogSidebar.reset')}
        />
      </VStack>
    </VStack>
  );
}

interface PreviewBlockProps {
  title: string;
  value: string;
  italic?: boolean;
  info?: string;
}

function PreviewBlock(props: PreviewBlockProps) {
  const { title, italic, info, value } = props;

  return (
    <VStack paddingX="medium">
      <HStack gap="small">
        <Typography variant="body3" bold>
          {title}
        </Typography>
        {info && <InfoTooltip text={info} />}
      </HStack>
      <Typography italic={italic} variant="body3">
        {value}
      </Typography>
    </VStack>
  );
}

interface SectionBlockProps {
  title: string;
  children: React.ReactNode;
}

function SectionBlock(props: SectionBlockProps) {
  const { title, children } = props;

  return (
    <VStack gap="small" borderBottom paddingBottom="large" fullWidth>
      <VStack padding="small">
        <Typography uppercase variant="body3" bold>
          {title}
        </Typography>
      </VStack>
      <VStack gap="large">{children}</VStack>
    </VStack>
  );
}

interface ToolPreviewDialogProps {
  tool: ToolSchema;
}

function ToolPreviewDialog(props: ToolPreviewDialogProps) {
  const { tool } = props;
  const t = useTranslations('ImportAgentsDialog');

  if (tool.tool_type.includes('letta')) {
    return (
      <HStack align="center" padding="xxsmall" border>
        <Typography font="mono" variant="body3">
          {tool.name}
        </Typography>
      </HStack>
    );
  }

  return (
    <Dialog
      size="xlarge"
      hideConfirm
      cancelText={t('AgentPreview.tools.dialog.close')}
      title={t('AgentPreview.tools.dialog.title', {
        name: tool.name,
      })}
      trigger={
        <HStack
          className="cursor-pointer"
          align="center"
          padding="xxsmall"
          border
        >
          <Typography font="mono" variant="body3">
            {tool.name}
          </Typography>
          <EyeOpenIcon size="xsmall" />
        </HStack>
      }
    >
      <RawCodeEditor
        label=""
        fullWidth
        hideLabel
        fontSize="small"
        showLineNumbers={false}
        language="javascript"
        code={tool?.source_code || ''}
      />
    </Dialog>
  );
}

interface MessagesPreviewDialogProps {
  messages: MessageSchema[];
}

function MessagesPreviewDialog(props: MessagesPreviewDialogProps) {
  const { messages } = props;
  const t = useTranslations('ImportAgentsDialog');

  return (
    <Dialog
      hideConfirm
      size="xlarge"
      cancelText={t('MessagesPreviewDialog.close')}
      title={t('MessagesPreviewDialog.title')}
      trigger={
        <Button
          color="secondary"
          size="small"
          label={t('MessagesPreviewDialog.trigger')}
        />
      }
    >
      <RawCodeEditor
        label=""
        fullWidth
        hideLabel
        fontSize="small"
        showLineNumbers={false}
        language="javascript"
        code={JSON.stringify(messages, null, 2)}
      />
    </Dialog>
  );
}

interface AgentPreviewProps {
  schema: Partial<AgentSchema>;
}

function AgentPreview(props: AgentPreviewProps) {
  const { schema } = props;

  const t = useTranslations('ImportAgentsDialog');

  return (
    <VStack overflowY="auto" fullWidth fullHeight>
      <VStack
        className="border-[50px] border-background-grey"
        fullWidth
        fullHeight
        color="background"
      >
        <VStack color="background" className="shadow-lg">
          <SectionBlock title={t('AgentPreview.general')}>
            <PreviewBlock
              info={t('AgentPreview.name.info')}
              title={t('AgentPreview.name.label')}
              value={schema?.name || ''}
            />
            <PreviewBlock
              title={t('AgentPreview.description')}
              value={schema?.description || ''}
            />
            <PreviewBlock
              title={t('AgentPreview.tags.label')}
              italic={!schema?.tags || schema?.tags.length === 0}
              value={
                Array.isArray(schema?.tags)
                  ? /* eslint-disable-next-line @typescript-eslint/no-base-to-string */
                    schema.tags.join(',')
                  : t('AgentPreview.tags.none')
              }
            />
          </SectionBlock>
          <SectionBlock title={t('AgentPreview.coreMemories')}>
            {(schema?.core_memory || []).map((memory, index) => (
              <PreviewBlock
                key={index}
                title={memory.label}
                value={memory.value}
              />
            ))}
          </SectionBlock>
          <SectionBlock title={t('AgentPreview.embeddingConfig')}>
            <RawCodeEditor
              label=""
              fullWidth
              variant="minimal"
              hideLabel
              fontSize="small"
              showLineNumbers={false}
              language="javascript"
              code={JSON.stringify(schema.embedding_config, null, 2)}
            />
          </SectionBlock>
          <SectionBlock title={t('AgentPreview.llmConfig')}>
            <RawCodeEditor
              label=""
              fullWidth
              variant="minimal"
              hideLabel
              fontSize="small"
              showLineNumbers={false}
              language="javascript"
              code={JSON.stringify(schema.llm_config, null, 2)}
            />
          </SectionBlock>
          <SectionBlock title={t('AgentPreview.tools.label')}>
            <HStack wrap paddingX="small">
              {(schema?.tools || []).map((tool) => (
                <ToolPreviewDialog key={tool.name} tool={tool} />
              ))}
              {!schema?.tools && (
                <Typography italic variant="body3">
                  {t('AgentPreview.tools.none')}
                </Typography>
              )}
            </HStack>
          </SectionBlock>
          <SectionBlock title={t('AgentPreview.toolRules.label')}>
            <VStack paddingX="medium">
              {(schema?.tool_rules || []).map((rule, index) => (
                <HStack key={index} align="center" fullWidth>
                  <Typography variant="body3" bold>
                    {rule.type}
                  </Typography>
                  <ArrowLeftIcon />
                  <Typography variant="body3">{rule.tool_name}</Typography>
                </HStack>
              ))}
              {!schema?.tool_rules && (
                <Typography italic variant="body3">
                  {t('AgentPreview.toolRules.none')}
                </Typography>
              )}
            </VStack>
          </SectionBlock>
          <SectionBlock title={t('AgentPreview.messages.label')}>
            <HStack align="center" paddingX="medium" fullWidth>
              {!Array.isArray(schema?.messages) ? (
                <Typography italic variant="body3">
                  {t('AgentPreview.messages.none')}
                </Typography>
              ) : (
                <HStack align="center" justify="spaceBetween" fullWidth>
                  <Typography variant="body3">
                    {t('AgentPreview.messages.count', {
                      count: schema.messages.length,
                    })}
                  </Typography>
                  <MessagesPreviewDialog messages={schema.messages} />
                </HStack>
              )}
            </HStack>
          </SectionBlock>
          <SectionBlock title={t('AgentPreview.system')}>
            <HStack paddingX="medium">
              <Typography variant="body3">{schema?.system}</Typography>
            </HStack>
          </SectionBlock>
        </VStack>
        <div className="min-h-[50px] flex w-full"></div>
      </VStack>
    </VStack>
  );
}

export function ImportAgentsDialog(props: ImportAgentsDialogProps) {
  const {
    trigger,
    projectId,
    onSuccess,
    supportTemplateUploading = false,
    defaultTemplateImport = false,
  } = props;
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const t = useTranslations('ImportAgentsDialog');

  const UploadToFormValuesSchema = useMemo(
    () =>
      z.object({
        file: z
          .custom<File>((v) => v instanceof File, {
            message: t('errors.fileIsRequired'),
          })
          .nullable(),
        overrideExistingTools: z.boolean(),
        appendCopySuffix: z.boolean(),
        importAsTemplate: z.boolean().optional(),
      }),
    [t],
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
      await queryClient.refetchQueries({
        queryKey: ['infinite', ...UseAgentsServiceListAgentsKeyFn()].slice(
          0,
          -1,
        ),
        exact: false,
      });

      if (onSuccess) {
        onSuccess(res.id, false);
      }

      handleDialogOpenChange(false);
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
  const [fileData, setFileData] = useState<Partial<AgentSchema> | null>(null);
  const [fileReadError, setFileReadError] = useState<string | null>(null);

  const onSubmit = useCallback(
    (values: UploadToFormValues) => {
      if (!file) {
        return;
      }

      if (values.importAsTemplate) {
        importTemplate({
          body: {
            file: file,
          },
          query: {
            append_copy_suffix: values.appendCopySuffix,
            override_existing_tools: values.overrideExistingTools,
            ...(projectId ? { project_id: projectId } : {}),
          },
        });
        return;
      }

      importAgent({
        formData: {
          file: file,
        },
        ...(projectId ? { projectId } : {}),
        appendCopySuffix: values.appendCopySuffix,
        overrideExistingTools: values.overrideExistingTools,
      });
    },
    [importAgent, file, importTemplate, projectId],
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
        const response = zodTypes.AgentSchema.partial().parse(
          JSON.parse(content),
        );

        setFileData(response as AgentSchema);
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
    fileInputRef.current?.value && (fileInputRef.current.value = '');
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
                <AgentPreview schema={fileData} />
              )}
            </VStack>
            {fileData && (
              <AgentsDialogSidebar
                supportTemplateUploading={supportTemplateUploading}
                onReset={handleReset}
                isImporting={isImportAgentPending || isImportTemplatePending}
              />
            )}
          </HStack>
        </form>
      </MiniApp>
    </FormProvider>
  );
}
