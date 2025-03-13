import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useEffect } from 'react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgentMetaData } from '../../hooks';
import type { Tool } from '@letta-cloud/sdk-core';
import {
  isAPIError,
  type RetrieveToolResponse,
  useToolsServiceCreateTool,
  useToolsServiceDeleteTool,
  UseToolsServiceListToolsKeyFn,
  useToolsServiceModifyTool,
  useToolsServiceRetrieveTool,
  UseToolsServiceRetrieveToolKeyFn,
  useToolsServiceRunToolFromSource,
} from '@letta-cloud/sdk-core';
import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Breadcrumb,
  Button,
  CloseMiniApp,
  Code,
  CodeIcon,
  CogIcon,
  Debugger,
  Dialog,
  ExploreIcon,
  Form,
  FormActions,
  FormField,
  FormProvider,
  HiddenOnMobile,
  HStack,
  LoadingEmptyStatusComponent,
  MiniApp,
  RawCodeEditor,
  RawInput,
  Section,
  TabGroup,
  TerminalIcon,
  Typography,
  useForm,
  VStack,
  WarningIcon,
} from '@letta-cloud/ui-component-library';
import { atom, useAtom } from 'jotai';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { useDebouncedValue, useViewportSize } from '@mantine/hooks';
import { get } from 'lodash-es';
import { usePythonValidator } from '@letta-cloud/utils-client';
import type { PythonValidatorError } from '@letta-cloud/utils-client';
import { atomFamily } from 'jotai/utils';

import { AllToolsView } from './AllToolsView/AllToolsView';
import { ToolAppHeader } from './ToolAppHeader/ToolAppHeader';
import { useIsComposioConnected } from './AllToolsView/ViewTool/ViewTool';
import {
  isCurrentToolInViewOrEdit,
  useToolsExplorerState,
} from './useToolsExplorerState/useToolsExplorerState';

interface EditableToolSettings {
  returnCharLimit: number;
}

function DeleteToolButton() {
  const { currentTool, clearCurrentTool } = useToolsExplorerState();
  const t = useTranslations('ADE/Tools');

  const [isOpened, setIsOpened] = useState(false);

  const {
    mutate: deleteTool,
    isError,
    isPending,
  } = useToolsServiceDeleteTool();

  const handleDelete = useCallback(() => {
    if (currentTool?.mode !== 'edit') {
      return;
    }

    deleteTool(
      {
        toolId: currentTool.data.id,
      },
      {
        onSuccess: () => {
          clearCurrentTool();
          window.location.reload();
        },
      },
    );
  }, [clearCurrentTool, currentTool, deleteTool]);

  return (
    <Dialog
      isConfirmBusy={isPending}
      isOpen={isOpened}
      confirmColor="destructive"
      onOpenChange={setIsOpened}
      errorMessage={isError ? t('DeleteToolButton.error') : undefined}
      title={t('DeleteToolButton.title')}
      confirmText={t('DeleteToolButton.confirm')}
      onConfirm={handleDelete}
      trigger={
        <Button color="destructive" label={t('DeleteToolButton.trigger')} />
      }
    >
      {t('DeleteToolButton.description')}
    </Dialog>
  );
}

interface ToolSettingsProps {
  toolId?: string;
  onUpdateSettings: (settings: EditableToolSettings) => void;
  toolSettings: EditableToolSettings;
}

function ToolSettings(props: ToolSettingsProps) {
  const { toolId, onUpdateSettings, toolSettings } = props;
  const t = useTranslations('ADE/Tools');

  return (
    <VStack overflowY="auto" padding border fullHeight>
      <Section
        title={t('ToolSettings.title')}
        description={t('ToolSettings.description')}
      >
        <RawInput
          label={t('ToolSettings.returnCharLimit.label')}
          description={t('ToolSettings.returnCharLimit.description')}
          type="number"
          placeholder={t('ToolSettings.returnCharLimit.placeholder')}
          fullWidth
          value={toolSettings.returnCharLimit}
          onChange={(e) => {
            onUpdateSettings({
              ...toolSettings,
              returnCharLimit: parseInt(e.target.value, 10),
            });
          }}
        />
      </Section>
      {toolId && (
        <Section
          title={t('ToolSettings.deleteTool.title')}
          description={t('ToolSettings.deleteTool.description')}
        >
          <HStack>
            <DeleteToolButton />
          </HStack>
        </Section>
      )}
    </VStack>
  );
}

interface ToolEditorProps extends ToolSettingsProps {
  code: string;
  errorMessage?: string;
  onSetCode: (code: string) => void;
}

type LeftTabs = 'debugger' | 'error-message';

type ToolEditorEditModes = LeftTabs | 'settings' | 'source-code';

function ToolEditor(props: ToolEditorProps) {
  const { code, errorMessage, onSetCode } = props;
  const t = useTranslations('ADE/Tools');
  const [completedAt, setCompletedAt] = useState<number | null>(null);

  const { mutate, error, submittedAt, reset, data, isPending } =
    useToolsServiceRunToolFromSource();

  const inputConfig = useMemo(
    () => ({
      defaultInput: {},
      schema: z.record(z.string(), z.any()),
      inputLabel: t('ToolEditor.inputLabel'),
    }),
    [t],
  );

  const extractedFunctionName = useMemo(() => {
    const nameRegex = /def\s+(\w+)\s*\(/;
    const match = nameRegex.exec(code);

    return match ? match[1] : '';
  }, [code]);

  const handleRun = useCallback(
    (input: z.infer<typeof inputConfig.schema>) => {
      reset();

      mutate(
        {
          requestBody: {
            name: extractedFunctionName,
            args: input,
            source_code: code,
          },
        },
        {
          onSuccess: () => {
            setCompletedAt(Date.now());
          },
        },
      );
    },
    [code, extractedFunctionName, inputConfig, mutate, reset],
  );

  const { outputValue, outputStdout, outputStderr, outputStatus } =
    useMemo(() => {
      if (data) {
        const { stdout, stderr, ...outputValue } = data;
        return {
          outputValue: JSON.stringify(outputValue.tool_return, null, 2), // stringify ensures that the output won't be highlighted
          outputStdout: stdout?.join('\n') ?? '',
          outputStderr: stderr?.join('\n') ?? '',
          outputStatus:
            data.status === 'error' ? ('error' as const) : ('success' as const),
        };
      }

      return {
        outputValue: error ? JSON.stringify(error, null, 2) : null,
        outputStdout: '',
        outputStderr: '',
        outputStatus: error ? ('error' as const) : undefined,
      };
    }, [data, error]);

  const [mode, setMode] = useState<ToolEditorEditModes>('source-code');

  const { validatePython } = usePythonValidator();

  const [debouncedCode] = useDebouncedValue(code, 500);
  const [validationErrors, setValidationErrors] = useState<
    PythonValidatorError[]
  >([]);
  useEffect(() => {
    if (validatePython) {
      void validatePython(debouncedCode).then(({ errors }) => {
        setValidationErrors(errors);
      });
    }
  }, [debouncedCode, validatePython]);

  const validationErrorsToLineNumberMap = useMemo(() => {
    return validationErrors.reduce((acc, error) => {
      if (!error.line) {
        return acc;
      }

      return {
        ...acc,
        [error.line]: error.message,
      };
    }, {});
  }, [validationErrors]);

  const [leftTabs, setLeftTabs] = useState<LeftTabs>('debugger');

  useEffect(() => {
    if (errorMessage) {
      setLeftTabs('error-message');
    } else {
      setLeftTabs('debugger');
    }
  }, [errorMessage]);

  const debuggerUI = (
    <Debugger
      hideLabel
      preLabelIcon={<TerminalIcon />}
      isRunning={isPending}
      onRun={handleRun}
      output={{
        status: outputStatus,
        duration: completedAt ? completedAt - submittedAt : undefined,
        responses: [
          {
            label: t('ToolEditor.outputLabel'),
            value: 'tool-output',
            content: outputValue ?? '',
          },
          {
            label: 'stdout',
            value: 'stdout',
            content: outputStdout,
          },
          {
            label: 'stderr',
            value: 'stderr',
            content: outputStderr,
          },
        ],
      }}
      inputConfig={inputConfig}
      label={t('ToolEditor.label')}
    />
  );

  const errorMessageUI = (
    <VStack fullWidth fullHeight padding="small" border>
      <Typography variant="body2" color="destructive" font="mono">
        {errorMessage}
      </Typography>
    </VStack>
  );

  const leftTabItems = [
    {
      label: t('ToolEditor.label'),
      value: 'debugger',
      icon: <TerminalIcon />,
    },
    ...(errorMessage
      ? [
          {
            color: 'destructive',
            icon: <WarningIcon />,
            label: t('ToolEditor.error'),
            value: 'error-message',
          },
        ]
      : []),
  ];

  const { width = 0 } = useViewportSize();

  const [debouncedWidth] = useDebouncedValue(width, 100);

  return (
    <HStack gap="small" flex overflow="hidden" fullWidth>
      <VStack overflow="hidden" fullWidth fullHeight gap={false}>
        <TabGroup
          variant="bordered-background"
          onValueChange={(value) => {
            setMode(value as ToolEditorEditModes);
          }}
          value={mode}
          items={[
            {
              icon: <CodeIcon />,
              label: t('ToolEditor.sourceCode.label'),
              value: 'source-code',
            },
            {
              icon: <CogIcon />,
              label: t('ToolEditor.settings.label'),
              value: 'settings',
            },
            ...(debouncedWidth < 640 ? leftTabItems : []),
          ]}
        />
        {mode === 'source-code' && (
          <RawCodeEditor
            preLabelIcon={<CodeIcon />}
            collapseHeight
            fullWidth
            flex
            lineNumberError={validationErrorsToLineNumberMap}
            fullHeight
            language="python"
            fontSize="small"
            code={code}
            onSetCode={onSetCode}
            hideLabel
            label={t('ToolCreator.sourceCode.label')}
          />
        )}
        {mode === 'settings' && (
          <ToolSettings
            toolSettings={props.toolSettings}
            onUpdateSettings={props.onUpdateSettings}
            toolId={props.toolId}
          />
        )}
        {mode === 'debugger' && debuggerUI}
        {mode === 'error-message' && errorMessageUI}
      </VStack>
      <HiddenOnMobile>
        <VStack overflow="hidden" gap={false} fullWidth fullHeight>
          <TabGroup
            variant="bordered-background"
            value={leftTabs}
            onValueChange={(val) => {
              setLeftTabs(val as LeftTabs);
            }}
            items={leftTabItems}
          />
          {leftTabs === 'debugger' ? debuggerUI : errorMessageUI}
        </VStack>
      </HiddenOnMobile>
    </HStack>
  );
}

interface ErrorMessageAlertProps {
  message: string;
  onDismiss: VoidFunction;
}

function ErrorMessageAlert(props: ErrorMessageAlertProps) {
  const { message, onDismiss } = props;
  const t = useTranslations('ADE/Tools');

  return (
    <Alert
      variant="destructive"
      title={t('ErrorMessageAlert.title')}
      onDismiss={onDismiss}
      fullWidth
    >
      <Code
        showLineNumbers={false}
        fontSize="small"
        language="javascript"
        code={message}
      />
    </Alert>
  );
}

const DEFAULT_SOURCE_CODE = `def roll_d20():
    """
    Simulate the roll of a 20-sided die (d20).

    This function generates a random integer between 1 and 20, inclusive,
    which represents the outcome of a single roll of a d20.

    Returns:
        str: The result of the die roll.
    """
    import random
    dice_role_outcome = random.randint(1, 20)
    output_string = f"You rolled a {dice_role_outcome}"
    return output_string
`;

function ToolCreator() {
  const t = useTranslations('ADE/Tools');
  const { clearCurrentTool, setCurrentTool } = useToolsExplorerState();

  const createToolSchema = useMemo(() => {
    return z.object({
      sourceCode: z.string(),
    });
  }, []);

  const queryClient = useQueryClient();

  const {
    mutate,
    error,
    isPending: isCreatingTool,
    reset,
    isSuccess,
  } = useToolsServiceCreateTool({
    onSuccess: (data) => {
      setCurrentTool(
        {
          id: data.id || '',
          name: data.name || '',
          description: data.description || '',
          brand: 'custom',
          provider: 'custom',
          imageUrl: null,
          providerId: '',
        },
        'view',
      );

      void queryClient.setQueriesData<Tool[] | undefined>(
        {
          queryKey: UseToolsServiceListToolsKeyFn({ limit: 1000 }),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return [...oldData, data];
        },
      );
    },
  });

  const [settings, setSettings] = useState<EditableToolSettings>({
    returnCharLimit: 6000,
  });

  const form = useForm<z.infer<typeof createToolSchema>>({
    resolver: zodResolver(createToolSchema),
    defaultValues: {
      sourceCode: DEFAULT_SOURCE_CODE,
    },
  });

  const handleSubmit = useCallback(
    (values: z.infer<typeof createToolSchema>) => {
      mutate({
        requestBody: {
          tags: [],
          source_type: 'python',
          return_char_limit: settings.returnCharLimit,
          description: '',
          source_code: values.sourceCode,
        },
      });
    },
    [mutate, settings],
  );

  const { isLocal } = useCurrentAgentMetaData();

  const errorMessage = useMemo(() => {
    if (!error) {
      return '';
    }

    const defaultError = !isLocal
      ? { message: 'Unhandled error, please contact support' }
      : error;

    let message: unknown = '';

    if (isAPIError(error)) {
      message = error.body;
    }

    return JSON.stringify(message || defaultError, null, 2);
  }, [error, isLocal]);

  return (
    <VStack gap={false} flex collapseHeight paddingBottom>
      <ToolAppHeader borderBottom>
        <HStack>
          <Breadcrumb
            size="small"
            items={[
              {
                preIcon: <ExploreIcon />,
                onClick: clearCurrentTool,
                label: t('EditToolWrapper.root'),
              },
              {
                label: t('ToolCreator.new'),
              },
            ]}
          />
        </HStack>
      </ToolAppHeader>
      {errorMessage && (
        <ErrorMessageAlert message={errorMessage} onDismiss={reset} />
      )}
      <VStack paddingTop="small" flex collapseHeight paddingX fullWidth>
        <FormProvider {...form}>
          <Form onSubmit={form.handleSubmit(handleSubmit)}>
            <VStack fullHeight flex gap="form" fullWidth>
              <FormField
                control={form.control}
                name="sourceCode"
                render={({ field }) => (
                  <ToolEditor
                    toolSettings={settings}
                    onUpdateSettings={setSettings}
                    code={field.value}
                    onSetCode={field.onChange}
                  />
                )}
              />
              <FormActions>
                <CloseMiniApp asChild>
                  <Button
                    type="button"
                    color="secondary"
                    label={t('SpecificToolComponent.back')}
                  />
                </CloseMiniApp>
                <Button
                  type="submit"
                  label="Create"
                  data-testid="submit-create-tool"
                  color="primary"
                  busy={isCreatingTool || isSuccess}
                />
              </FormActions>
            </VStack>
          </Form>
        </FormProvider>
      </VStack>
    </VStack>
  );
}

interface EditToolProps {
  tool: Tool;
}

const sourceCodeAtom = atomFamily((sourceCode: string) => atom(sourceCode));

function EditTool(props: EditToolProps) {
  const { tool } = props;

  const [confirmUpdateTool, setConfirmUpdateTool] = useState(false);
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<EditableToolSettings>({
    returnCharLimit: tool.return_char_limit || 1000,
  });

  const { switchToolState } = useToolsExplorerState();

  const [sourceCode, setSourceCode] = useAtom(
    sourceCodeAtom(tool.source_code || ''),
  );

  const [localError, setLocalError] = useState<string | null>(null);
  const { mutate, isPending, reset, error } = useToolsServiceModifyTool();

  const t = useTranslations('ADE/Tools');

  const handleConfirmUpdateToolVisibility = useCallback(
    (visibility: boolean) => {
      if (!visibility) {
        reset();
      }

      setConfirmUpdateTool(visibility);
    },
    [reset],
  );

  const handleUpdateCode = useCallback(() => {
    setLocalError(null);

    if (z.number().positive().safeParse(settings.returnCharLimit).error) {
      setLocalError(t('ToolSettings.returnCharLimit.error'));
      return;
    }

    mutate(
      {
        toolId: tool.id || '',
        requestBody: {
          source_code: sourceCode,
          return_char_limit: settings.returnCharLimit,
        },
      },
      {
        onError: () => {
          setConfirmUpdateTool(false);
        },
        onSuccess: () => {
          queryClient.setQueriesData<RetrieveToolResponse | undefined>(
            {
              queryKey: UseToolsServiceRetrieveToolKeyFn({
                toolId: tool.id || '',
              }),
            },
            (oldData) => {
              if (!oldData) {
                return oldData;
              }

              return {
                ...oldData,
                return_char_limit: settings.returnCharLimit,
                source_code: sourceCode,
              };
            },
          );

          switchToolState('view');
          handleConfirmUpdateToolVisibility(false);
        },
      },
    );
  }, [
    mutate,
    queryClient,
    t,
    switchToolState,
    handleConfirmUpdateToolVisibility,
    settings.returnCharLimit,
    sourceCode,
    tool.id,
  ]);

  const errorMessage = useMemo(() => {
    if (localError) {
      return localError;
    }

    if (!error) {
      return '';
    }

    let message: unknown = '';

    if (isAxiosError(error)) {
      message = error.response?.data;
    }

    const res = message || error;
    const response = get(res, 'body.detail', res);

    return JSON.stringify(response, null, 2);
  }, [error, localError]);

  return (
    <VStack collapseHeight paddingX paddingBottom flex gap="form">
      <ToolEditor
        errorMessage={errorMessage}
        toolSettings={settings}
        onUpdateSettings={setSettings}
        toolId={tool.id}
        code={sourceCode}
        onSetCode={setSourceCode}
      />

      <FormActions>
        <CloseMiniApp asChild>
          <Button color="secondary" label={t('EditTool.close')} />
        </CloseMiniApp>
        <Dialog
          title={t('EditTool.updateDialog.title')}
          onConfirm={handleUpdateCode}
          onOpenChange={(open) => {
            if (!open) {
              setLocalError(null);
            }

            setConfirmUpdateTool(open);
          }}
          isOpen={confirmUpdateTool}
          isConfirmBusy={isPending}
          trigger={
            <Button
              type="button"
              label={t('EditTool.update')}
              color="primary"
            />
          }
        >
          {t('EditTool.updateDialog.description')}
        </Dialog>
      </FormActions>
    </VStack>
  );
}

function EditToolWrapper() {
  const { currentTool, clearCurrentTool, switchToolState } =
    useToolsExplorerState();

  const toolId = useMemo(() => {
    if (isCurrentToolInViewOrEdit(currentTool)) {
      return currentTool?.data.id || '';
    }

    return '';
  }, [currentTool]);

  const toolName = useMemo(() => {
    if (!isCurrentToolInViewOrEdit(currentTool)) {
      return '';
    }

    return currentTool?.data.name || '';
  }, [currentTool]);

  const { data: tool } = useToolsServiceRetrieveTool(
    {
      toolId,
    },
    undefined,
    {
      enabled: !!toolId,
    },
  );

  const t = useTranslations('ADE/Tools');

  return (
    <VStack fullHeight fullWidth>
      <ToolAppHeader borderBottom>
        <HStack>
          <Breadcrumb
            size="small"
            items={[
              {
                preIcon: <ExploreIcon />,
                onClick: clearCurrentTool,
                label: t('EditToolWrapper.root'),
              },
              {
                onClick: () => {
                  switchToolState('view');
                },
                label: `${
                  toolName || tool?.name || t('EditToolWrapper.unnamed')
                }()`,
              },
              {
                label: t('EditToolWrapper.edit'),
              },
            ]}
          />
        </HStack>
      </ToolAppHeader>
      {!tool ? (
        <LoadingEmptyStatusComponent
          hideText
          loaderVariant="grower"
          emptyMessage=""
          isLoading
        />
      ) : (
        <EditTool tool={tool} />
      )}
    </VStack>
  );
}

export function ToolsExplorer() {
  const t = useTranslations('ADE/Tools');
  useIsComposioConnected();

  webApi.toolMetadata.getToolMetadataSummary.useQuery({
    queryKey: webApiQueryKeys.toolMetadata.getToolMetadataSummary,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const {
    isToolExplorerOpen,
    currentTool,
    closeToolExplorer,
    openToolExplorer,
  } = useToolsExplorerState();

  const [openConfirmLeave, setOpenConfirmLeave] = useState(false);

  const handleOpen = useCallback(
    (nextState: boolean, force?: boolean) => {
      if (!nextState) {
        if (!force) {
          if (currentTool?.mode === 'edit' || currentTool?.mode === 'create') {
            setOpenConfirmLeave(true);
            return;
          }
        }

        setOpenConfirmLeave(false);
        closeToolExplorer();
        return;
      }

      openToolExplorer();
    },
    [closeToolExplorer, currentTool?.mode, openToolExplorer],
  );

  const component = useMemo(() => {
    if (currentTool?.mode === 'create') {
      return <ToolCreator />;
    }

    if (currentTool?.mode === 'edit') {
      return <EditToolWrapper />;
    }

    return <AllToolsView />;
  }, [currentTool]);

  return (
    <MiniApp
      isOpen={isToolExplorerOpen}
      onOpenChange={handleOpen}
      appName="Tool Explorer"
    >
      <Dialog
        title={t('ToolsExplorer.confirmLeave.title')}
        isOpen={openConfirmLeave}
        onOpenChange={setOpenConfirmLeave}
        onConfirm={() => {
          handleOpen(false, true);
        }}
      >
        {t('ToolsExplorer.confirmLeave.description')}
      </Dialog>
      {component}
    </MiniApp>
  );
}
