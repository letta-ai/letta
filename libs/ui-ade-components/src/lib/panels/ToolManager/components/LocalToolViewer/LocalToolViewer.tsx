'use client';
import {
  isAPIError,
  type Tool,
  type ToolJSONSchema,
  type ToolUpdate,
  useToolsServiceGenerateJsonSchema,
  UseToolsServiceListToolsKeyFn,
  useToolsServiceModifyTool,
  UseToolsServiceRetrieveToolKeyFn,
} from '@letta-cloud/sdk-core';
import {
  Accordion,
  Badge,
  Button,
  Code,
  CodeIcon,
  CogIcon,
  DataObjectIcon,
  ErrorIcon,
  HistoryIcon,
  HStack,
  RawCodeEditor,
  SplitscreenRightIcon,
  TabGroup,
  ToolboxIcon,
  ToolsIcon,
  Tooltip,
  Typography,
  VStack,
  WarningIcon,
  WrapNotificationDot,
} from '@letta-cloud/ui-component-library';
import { ToolActionsHeader } from '../ToolActionsHeader/ToolActionsHeader';
import { useCurrentAgent, useCurrentAgentMetaData } from '../../../../hooks';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useStagedCode } from '../../hooks/useStagedCode/useStagedCode';
import { useToolValidation } from '../../hooks/useToolValidation/useToolValidation';
import { useDebouncedCallback, useDebouncedValue } from '@mantine/hooks';
import { useTranslations } from '@letta-cloud/translations';
import { ToolSimulator } from '../ToolSimulator/ToolSimulator';
import { DependencyViewer } from '../DependencyViewer/DependencyViewer';
import { ToolAssistant } from '../ToolAssistant/ToolAssistant';
import { ToolArgumentsProvider } from './ToolArgumentsContext';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { get, isEqual } from 'lodash-es';
import { atom, useAtom } from 'jotai';
import { ToolSettings } from '../ToolsSettings/ToolSettings';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

interface CurrentToolContextState {
  tool: Tool;
  mode: EditMode;
  setMode: (mode: EditMode) => void;
  error?: string | null;
  setError: (error: string | null) => void;
}

const CurrentToolContext = createContext<CurrentToolContextState | null>(null);

interface CurrentToolProviderProps {
  tool: Tool;
  children: React.ReactNode;
}

function CurrentToolProvider(props: CurrentToolProviderProps) {
  const { tool, children } = props;
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<EditMode>('simulator');

  return (
    <CurrentToolContext.Provider
      value={{
        mode,
        setMode,
        tool,
        error,
        setError,
      }}
    >
      {children}
    </CurrentToolContext.Provider>
  );
}

function useToolErrors() {
  const response = useContext(CurrentToolContext);

  if (!response) {
    throw new Error('useToolErrors must be used within a CurrentToolProvider');
  }

  return {
    error: response.error,
    setError: response.setError,
  };
}

export function useCurrentTool() {
  const response = useContext(CurrentToolContext);

  if (!response) {
    throw new Error('useCurrentTool must be used within a CurrentToolProvider');
  }

  return response.tool;
}

function ErrorViewer() {
  const { error } = useToolErrors();
  const t = useTranslations('ToolsEditor/LocalToolsViewer');

  const errorResponse = useMemo(() => {
    if (!error) {
      return t('ErrorViewer.noError');
    }

    return JSON.stringify(error, null, 2);
  }, [error, t]);

  return (
    <VStack fullHeight fullWidth>
      <RawCodeEditor
        fontSize="small"
        fullHeight
        fullWidth
        flex
        variant="minimal"
        label=""
        showLineNumbers={false}
        hideLabel
        language="javascript"
        code={errorResponse}
      />
    </VStack>
  );
}

function RestoreToolButton() {
  const tool = useCurrentTool();
  const { setError } = useToolErrors();
  const { isDirty, resetStagedTool } = useStagedCode(tool);

  const [_, setJsonSchemaString] = useAtom<string>(jsonSchemaAtom);

  const t = useTranslations('ToolsEditor/LocalToolsViewer');

  const handleRestore = useCallback(() => {
    if (!tool) {
      return;
    }

    setError(null);
    setJsonSchemaString(JSON.stringify(tool.json_schema || {}, null, 2));
    resetStagedTool();
  }, [resetStagedTool, tool, setError, setJsonSchemaString]);

  if (!isDirty) {
    return null;
  }

  return (
    <Button
      label={t('RestoreToolButton.label')}
      color="tertiary"
      hideLabel
      preIcon={<HistoryIcon />}
      onClick={handleRestore}
      size="small"
    />
  );
}

interface CodeEditorProps {
  tool: Tool;
}

function CodeEditor(props: CodeEditorProps) {
  const { tool } = props;
  const { stagedTool, setStagedTool } = useStagedCode(tool);
  const { data: typescriptToolsEnabled } = useFeatureFlag('TYPESCRIPT_TOOLS');

  const { validationErrorsToLineNumberMap } = useToolValidation(
    stagedTool.source_code || '',
  );

  const debouncedSetStagedTool = useDebouncedCallback(setStagedTool, 500);

  const [localCode, setLocalCode] = useState<string>(
    stagedTool.source_code || '',
  );

  // Determine language based on source_type
  const language = useMemo(() => {
    if (!typescriptToolsEnabled) {
      return 'python';
    }
    return stagedTool.source_type === 'typescript' ? 'typescript' : 'python';
  }, [stagedTool.source_type, typescriptToolsEnabled]);

  useEffect(() => {
    function handleResetLocalCode() {
      setLocalCode(tool.source_code || '');
    }

    document.addEventListener('resetStagedTool', handleResetLocalCode);

    return () => {
      document.removeEventListener('resetStagedTool', handleResetLocalCode);
    };
  }, [tool.source_code]);

  useEffect(() => {
    function handleUpdateLocalCode(event: CustomEvent<{ code: string }>) {
      setLocalCode(event.detail.code);
    }

    document.addEventListener(
      'updateLocalCode',
      handleUpdateLocalCode as EventListener,
    );

    return () => {
      document.removeEventListener(
        'updateLocalCode',
        handleUpdateLocalCode as EventListener,
      );
    };
  }, []);

  const handleCodeChange = useCallback(
    (code: string) => {
      setLocalCode(code);

      debouncedSetStagedTool((prev) => ({
        ...prev,
        source_code: code,
      }));
    },
    [debouncedSetStagedTool],
  );

  return (
    <VStack fullWidth overflowX="auto" fullHeight>
      <RawCodeEditor
        fontSize="small"
        hideLabel
        flex
        fullWidth
        highlightCurrentLine
        collapseHeight
        lineNumberError={validationErrorsToLineNumberMap}
        onSetCode={handleCodeChange}
        variant="minimal"
        label=""
        language={language}
        code={localCode}
      />
    </VStack>
  );
}

interface CompileErrorMessageProps {
  error: unknown;
}

function CompileErrorMessage(props: CompileErrorMessageProps) {
  const { error } = props;

  const t = useTranslations('ToolsEditor/LocalToolsViewer');

  const compileErrorMessage = useMemo(() => {
    if (error) {
      if (isAPIError(error)) {
        if (error.body.detail?.includes('lacks a description')) {
          const extractedParameters = /Parameter '(.+?)'/.exec(
            error.body.detail,
          );

          if (!extractedParameters) {
            return {
              message: error.body.detail.replace(
                '400: Failed to generate schema: ',
                '',
              ),
              type: 'generic',
            };
          }

          return {
            message: t.rich('JSONSchemaViewer.errors.description', {
              parameter: () => (
                <Typography bold overrideEl="span">
                  {extractedParameters[1]}
                </Typography>
              ),
            }),
            parameter: extractedParameters[1],
            type: 'parameter',
          };
        }

        if (error.body.detail) {
          return {
            message: error.body.detail.replace(
              '400: Failed to generate schema: ',
              '',
            ),
            type: 'generic',
          };
        }
      }

      return {
        message: t('JSONSchemaViewer.errors.unknown'),
        type: 'generic',
      };
    }

    return null;
  }, [error, t]);

  if (!compileErrorMessage) {
    return null;
  }

  return (
    <VStack color="destructive" borderBottom padding="small">
      <HStack>
        <Badge
          size="small"
          variant="destructive"
          preIcon={<WarningIcon />}
          content={t('buildError')}
        />
      </HStack>
      <Typography variant="body2">{compileErrorMessage.message}</Typography>
      {compileErrorMessage.type === 'parameter' && (
        <HStack>
          <Accordion
            theme="destructive"
            id="example-code"
            trigger={
              <Typography variant="body3" color="inherit" bold>
                {t('docstringExample.label')}
              </Typography>
            }
          >
            <Code
              fontSize="small"
              language="python"
              code={`def example_function(parameter: str) -> None:
    """
    Example function that demonstrates how to use the parameter.

    Args:
        ${compileErrorMessage.parameter}: The definition of your parameter.
    """
            `}
            />
          </Accordion>
        </HStack>
      )}
    </VStack>
  );
}

const jsonSchemaAtom = atom<string>('');

interface JSONSchemaViewerProps {
  tool: Tool;
}

export function JSONSchemaViewer(props: JSONSchemaViewerProps) {
  const { tool } = props;
  const { stagedTool, setStagedTool } = useStagedCode(tool);

  const mounted = useRef(false);

  const [jsonSchemaString, setJsonSchemaString] =
    useAtom<string>(jsonSchemaAtom);

  useEffect(() => {
    if (!mounted.current) {
      setJsonSchemaString(
        JSON.stringify(stagedTool.json_schema || {}, null, 2),
      );
      mounted.current = true;
    }
  }, [stagedTool.json_schema, setJsonSchemaString]);

  const t = useTranslations('ToolsEditor/LocalToolsViewer');

  const [parsingError, setParsingError] = useState<string | null>(null);

  const { isDifferent } = useIsCodeAndSchemaDifferent();

  const validationErrorsToLineNumberMap = useMemo(() => {
    // look in the parsing error for line {lineNumber}

    if (!parsingError) {
      return {};
    }

    const match = new RegExp(/line (\d+)/).exec(parsingError || '');

    if (!match) {
      return {};
    }

    return {
      [parseInt(match[1], 10)]: parsingError,
    };
  }, [parsingError]);

  const parsedJsonSchema = useMemo(() => {
    try {
      const res = JSON.parse(jsonSchemaString);
      setParsingError(null);

      return res as ToolJSONSchema;
    } catch (error) {
      const maybeMessage = get(error, 'message');
      if (typeof maybeMessage === 'string') {
        setParsingError(maybeMessage);
      }
      return null;
    }
  }, [jsonSchemaString]);

  useEffect(() => {
    if (parsedJsonSchema) {
      setStagedTool((prev) => ({
        ...prev,
        json_schema: parsedJsonSchema,
      }));
    }
  }, [setStagedTool, parsedJsonSchema]);

  useEffect(() => {
    function handleJsonSchemaUpdate(
      event: CustomEvent<{ schema: ToolJSONSchema }>,
    ) {
      if (event.detail.schema) {
        setJsonSchemaString(JSON.stringify(event.detail.schema, null, 2));
        setParsingError(null);
      }
    }

    document.addEventListener(
      'updateJsonSchema',
      handleJsonSchemaUpdate as EventListener,
    );

    return () => {
      document.removeEventListener(
        'updateJsonSchema',
        handleJsonSchemaUpdate as EventListener,
      );
    };
  }, [setJsonSchemaString]);

  const { mutate, isPending, error, reset } =
    useToolsServiceGenerateJsonSchema();

  const alignJSONSchemaWithTool = useCallback(() => {
    mutate(
      {
        requestBody: {
          code: stagedTool.source_code || '',
        },
      },
      {
        onSuccess: (response) => {
          setStagedTool((prev) => ({
            ...prev,
            json_schema: response,
          }));

          setJsonSchemaString(JSON.stringify(response, null, 2));
          setParsingError(null);
        },
      },
    );
  }, [mutate, stagedTool.source_code, setStagedTool, setJsonSchemaString]);

  const errorMessage = useMemo(() => {
    if (parsingError) {
      return parsingError;
    }

    if (isDifferent) {
      return t('JSONSchemaViewer.different');
    }

    return null;
  }, [parsingError, t, isDifferent]);

  useEffect(() => {
    if (!isDifferent) {
      reset();
    }
  }, [isDifferent, reset]);

  return (
    <VStack fullHeight gap={false} fullWidth>
      <VStack gap={false}>
        {errorMessage && (
          <HStack
            justify="spaceBetween"
            gap="medium"
            borderTop
            color="warning"
            align="center"
            fullWidth
            padding="small"
          >
            <HStack align="start">
              <div className="mt-[-1px]">
                <WarningIcon />
              </div>
              <Typography variant="body3">{errorMessage}</Typography>
            </HStack>
            {(parsingError || isDifferent) && (
              <Button
                preIcon={<ToolsIcon />}
                color="primary"
                size="small"
                busy={isPending}
                label={t('JSONSchemaViewer.fix')}
                onClick={alignJSONSchemaWithTool}
              />
            )}
          </HStack>
        )}
        <CompileErrorMessage error={error} />
      </VStack>

      <RawCodeEditor
        fontSize="small"
        fullWidth
        flex
        collapseHeight
        lineNumberError={validationErrorsToLineNumberMap}
        border={false}
        variant="minimal"
        label=""
        showLineNumbers
        hideLabel
        language="javascript"
        onSetCode={setJsonSchemaString}
        code={jsonSchemaString}
      />
    </VStack>
  );
}

type EditMode =
  | 'code'
  | 'dependencies'
  | 'errors'
  | 'json'
  | 'settings'
  | 'simulator';

function EditModes() {
  const { mode, setMode } = useEditMode();
  const { error } = useToolErrors();
  const t = useTranslations('ToolsEditor/LocalToolsViewer');
  const { isDifferent } = useIsCodeAndSchemaDifferent();

  const { isLocal } = useCurrentAgentMetaData();

  return (
    <TabGroup
      variant="chips"
      color="dark"
      value={mode}
      onValueChange={(value) => {
        if (!value) {
          setMode('code');

          return;
        }
        setMode(value as EditMode);
      }}
      size="xsmall"
      items={[
        {
          icon: <SplitscreenRightIcon />,
          label: t('EditModes.modes.simulator'),
          value: 'simulator',
        },
        ...(!isLocal
          ? [
              {
                icon: <ToolboxIcon />,
                label: t('EditModes.modes.dependencies'),
                value: 'dependencies',
              },
            ]
          : []),
        {
          icon: (
            <WrapNotificationDot disabled={!isDifferent}>
              <DataObjectIcon className="mt-[-3px]" />
            </WrapNotificationDot>
          ),
          label: t('EditModes.modes.json'),
          value: 'json',
        },
        {
          icon: (
            <WrapNotificationDot disabled={!error}>
              <ErrorIcon className="mt-[-3px]" />
            </WrapNotificationDot>
          ),
          label: t('EditModes.modes.errors'),
          value: 'errors',
        },
        {
          icon: <CogIcon />,
          label: t('EditModes.modes.settings'),
          value: 'settings',
        },
      ]}
    />
  );
}

interface SaveToolButtonProps {
  tool: Tool;
}

function SaveToolButton(props: SaveToolButtonProps) {
  const { tool } = props;
  const { setMode } = useEditMode();
  const { setError } = useToolErrors();
  const { isDirty, stagedTool, setStagedTool } = useStagedCode(tool);
  const t = useTranslations('ToolsEditor/LocalToolsViewer');
  const { data: typescriptToolsEnabled } = useFeatureFlag('TYPESCRIPT_TOOLS');

  const queryClient = useQueryClient();
  const { mutate, isPending } = useToolsServiceModifyTool({
    onError: (error) => {
      let message: unknown = '';

      if (isAxiosError(error)) {
        message = error.response?.data;
      }

      const res = message || error;
      const response = get(res, 'body.detail', res);

      if (typeof response === 'string') {
        setMode('errors');
        setError(response);
      }
    },
    onSuccess: (response) => {
      queryClient.setQueriesData<Tool[] | undefined>(
        {
          queryKey: UseToolsServiceListToolsKeyFn(),
          exact: false,
        },
        (old) => {
          if (!old) {
            return old;
          }

          return old.map((t) => {
            if (t.id === tool.id) {
              return response;
            }

            return t;
          });
        },
      );

      queryClient.setQueriesData<Tool | undefined>(
        {
          queryKey: UseToolsServiceRetrieveToolKeyFn({ toolId: tool.id || '' }),
        },
        () => response,
      );

      setStagedTool(() => response);
    },
  });

  const handleSubmit = useCallback(() => {
    if (isDirty) {
      const isTypeScript = typescriptToolsEnabled && stagedTool.source_type === 'typescript';
      
      const descriptionValue = get(stagedTool.json_schema, 'description', '');
      const description = typeof descriptionValue === 'string' ? descriptionValue : '';
      
      const requestBody: ToolUpdate = {
        description,
        json_schema: stagedTool.json_schema,
        source_code: stagedTool.source_code || '',
        source_type: stagedTool.source_type || 'python',
        return_char_limit: stagedTool.return_char_limit,
      };
      
      // Include appropriate dependencies based on language
      if (isTypeScript) {
        requestBody.npm_requirements = stagedTool.npm_requirements || [];
      } else {
        requestBody.pip_requirements = stagedTool.pip_requirements || [];
      }
      
      mutate({
        toolId: tool.id || '',
        requestBody,
      });
    }
  }, [isDirty, mutate, stagedTool, tool.id, typescriptToolsEnabled]);

  return (
    <Button
      label={t('SaveToolButton.label')}
      color="primary"
      busy={isPending}
      onClick={handleSubmit}
      disabled={!isDirty}
    />
  );
}

interface ToolActionsProps {
  tool: Tool;
}

function ToolActions(props: ToolActionsProps) {
  const { tool } = props;

  return (
    <HStack gap="medium" align="center">
      <SaveToolButton tool={tool} />
    </HStack>
  );
}

function useEditMode() {
  const response = useContext(CurrentToolContext);

  if (!response) {
    throw new Error('useEditMode must be used within a CurrentToolProvider');
  }

  return {
    mode: response.mode,
    setMode: response.setMode,
  };
}

function ToolContent() {
  const { mode } = useEditMode();
  const tool = useCurrentTool();

  if (!tool) {
    return null;
  }

  switch (mode) {
    case 'simulator':
      return <ToolSimulator key={tool.id} tool={tool} />;
    case 'dependencies':
      return <DependencyViewer tool={tool} />;
    case 'errors':
      return <ErrorViewer />;
    case 'json':
      return <JSONSchemaViewer key={tool.id} tool={tool} />;

    case 'settings':
      return <ToolSettings tool={tool} />;
    default:
      return null;
  }
}

function useIsCodeAndSchemaDifferent() {
  const tool = useCurrentTool();
  const { stagedTool } = useStagedCode(tool);

  const [isDifferent, setIsDifferent] = useState(false);
  const { mutate } = useToolsServiceGenerateJsonSchema();

  const codeSchema = useMemo(() => {
    return stagedTool.json_schema;
  }, [stagedTool.json_schema]);

  const stagedCode = useMemo(() => {
    return stagedTool.source_code || '';
  }, [stagedTool.source_code]);

  const [debouncedStagedCode] = useDebouncedValue(stagedCode, 250);

  const handleCheckSchema = useCallback(() => {
    if (!tool || !codeSchema) {
      return;
    }
    mutate(
      {
        requestBody: {
          code: debouncedStagedCode,
        },
      },
      {
        onSuccess: (response) => {
          setIsDifferent(!isEqual(response, codeSchema));
        },
        onError: () => {
          setIsDifferent(true);
        },
      },
    );
  }, [tool, codeSchema, debouncedStagedCode, mutate]);

  useEffect(() => {
    if (!tool || !debouncedStagedCode) {
      return;
    }

    handleCheckSchema();
  }, [handleCheckSchema, tool, debouncedStagedCode]);

  return {
    isDifferent,
  };
}

function SchemaChangeWarning() {
  const t = useTranslations('ToolsEditor/LocalToolsViewer');

  const { isDifferent } = useIsCodeAndSchemaDifferent();

  const { setMode } = useEditMode();

  const navigateToJSONViewer = useCallback(() => {
    setMode('json');
  }, [setMode]);

  if (!isDifferent) {
    return null;
  }

  return (
    <Tooltip asChild content={t('SchemaChangeWarning.title')}>
      <button onClick={navigateToJSONViewer}>
        <Badge
          size="large"
          preIcon={<WarningIcon />}
          content={t('SchemaChangeWarning.error')}
          variant="warning"
        />
      </button>
    </Tooltip>
  );
}

function LocalToolPanels(props: LocalToolsViewerProps) {
  const { tool } = props;

  const { mode } = useEditMode();

  return (
    <VStack collapseWidth flex fullHeight>
      <PanelGroup
        className="h-full w-full"
        direction="horizontal"
        autoSaveId="code-editor"
      >
        <Panel
          defaultSize={mode === 'code' ? 100 : 60}
          defaultValue={mode === 'code' ? 100 : 60}
          className="h-full"
          minSize={mode === 'code' ? 100 : 30}
        >
          <CodeEditor tool={tool} />
        </Panel>
        {mode !== 'code' && (
          <>
            <PanelResizeHandle
              className="w-[1px] h-full bg-border"
              /* eslint-disable-next-line react/forbid-component-props */
              style={{ cursor: 'col-resize' }}
            />
            <Panel
              defaultSize={40}
              defaultValue={40}
              className="h-full"
              minSize={20}
            >
              <ToolContent />
            </Panel>
          </>
        )}
      </PanelGroup>
    </VStack>
  );
}

function CodeButton() {
  const { setMode, mode } = useEditMode();
  const t = useTranslations('ToolsEditor/LocalToolsViewer');

  return (
    <Button
      label={t('code')}
      color="tertiary"
      onClick={() => {
        setMode('code');
      }}
      preIcon={<CodeIcon />}
      active={mode === 'code'}
      size="xsmall"
    />
  );
}


interface LocalToolsViewerProps {
  tool: Tool;
}

export function LocalToolViewer(props: LocalToolsViewerProps) {
  const { tool } = props;

  const { tools } = useCurrentAgent();
  const { data: isAIAssistantEnabled } = useFeatureFlag('AI_TOOL_ASSISTANT');

  const isAttached = useMemo(() => {
    return tools?.some((t) => t.id === tool.id);
  }, [tools, tool.id]);

  return (
    <CurrentToolProvider tool={tool}>
      <ToolArgumentsProvider>
        <VStack gap={false} fullWidth fullHeight>
          <ToolActionsHeader
            idToAttach={tool.id || ''}
            attachedId={isAttached ? tool.id : undefined}
            type={tool.tool_type || 'custom'}
            sourceType={tool.source_type ?? undefined}
            name={tool.name || ''}
            actions={<ToolActions tool={tool} />}
          />
          <HStack
            overflowY="auto"
            fullWidth
            align="center"
            borderTop
            justify="spaceBetween"
            borderBottom
            height="header-sm"
            paddingX="medium"
          >
            <HStack align="center">
              {isAIAssistantEnabled ? (
                <ToolAssistant tool={tool} />
              ) : (
                <CodeButton />
              )}
            </HStack>

            <HStack align="center">
              <RestoreToolButton />
              <SchemaChangeWarning />
              <EditModes />
            </HStack>
          </HStack>
          <HStack collapseHeight fullWidth flex gap={false}>
            <LocalToolPanels tool={tool} />
          </HStack>
        </VStack>
      </ToolArgumentsProvider>
    </CurrentToolProvider>
  );
}
