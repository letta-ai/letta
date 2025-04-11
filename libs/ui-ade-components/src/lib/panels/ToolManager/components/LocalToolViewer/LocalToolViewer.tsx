import {
  type Tool,
  type ToolJSONSchema,
  UseToolsServiceListToolsKeyFn,
  useToolsServiceModifyTool,
  UseToolsServiceRetrieveToolKeyFn,
} from '@letta-cloud/sdk-core';
import {
  Badge,
  Button,
  CodeIcon,
  CogIcon,
  DataObjectIcon,
  ErrorIcon,
  HistoryIcon,
  HStack,
  RawCodeEditor,
  RawInput,
  RawToggleGroup,
  SaveIcon,
  SplitscreenRightIcon,
  ToolsIcon,
  Tooltip,
  Typography,
  useIsMobile,
  VStack,
  WarningIcon,
  WrapNotificationDot,
} from '@letta-cloud/ui-component-library';
import { ToolActionsHeader } from '../ToolActionsHeader/ToolActionsHeader';
import { useCurrentAgent } from '../../../../hooks';
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
import {
  type PythonValidatorError,
  usePythonValidator,
} from '@letta-cloud/utils-client';
import { useDebouncedCallback, useDebouncedValue } from '@mantine/hooks';
import { useTranslations } from '@letta-cloud/translations';
import { ToolSimulator } from '../ToolSimulator/ToolSimulator';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { get, isEqual } from 'lodash-es';
import {
  ADD_DESCRIPTION_PLACEHOLDER,
  generateJSONSchemaFromCode,
  jsonSchemaTypeMap,
  pythonCodeParser,
} from '@letta-cloud/utils-shared';
import { atom, useAtom } from 'jotai';
import { DeleteToolButton } from './DeleteToolButton/DeleteToolButton';

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
  const [mode, setMode] = useState<EditMode>('codeAndSimulator');

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

function CodeAndSimulator() {
  const tool = useCurrentTool();

  const isMobile = useIsMobile();

  if (!tool) {
    return null;
  }

  return (
    <PanelGroup
      /* eslint-disable-next-line react/forbid-component-props */
      className="h-full w-full"
      direction={isMobile ? 'vertical' : 'horizontal'}
      autoSaveId="code-and-simulator"
    >
      <Panel defaultSize={70} defaultValue={70} className="h-full" minSize={20}>
        <CodeEditor key={tool.id} tool={tool} />
      </Panel>
      <PanelResizeHandle
        /* eslint-disable-next-line react/forbid-component-props */
        className={isMobile ? 'h-[1px] w-full bg-border' : 'w-[1px] h-full'}
      />
      <Panel defaultSize={30} defaultValue={30} className="h-full" minSize={20}>
        <ToolSimulator key={tool.id} tool={tool} />
      </Panel>
    </PanelGroup>
  );
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
    <VStack fullHeight fullWidth borderLeft>
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

function CodeAndError() {
  const tool = useCurrentTool();

  const isMobile = useIsMobile();
  if (!tool) {
    return null;
  }

  return (
    <PanelGroup
      /* eslint-disable-next-line react/forbid-component-props */
      className="h-full w-full"
      direction={isMobile ? 'vertical' : 'horizontal'}
      autoSaveId="code-and-error"
    >
      <Panel defaultSize={70} defaultValue={70} className="h-full" minSize={20}>
        <CodeEditor tool={tool} />
      </Panel>
      <PanelResizeHandle
        /* eslint-disable-next-line react/forbid-component-props */
        className={isMobile ? 'h-[1px] w-full bg-border' : 'w-[1px] h-full'}
      />
      <Panel defaultSize={30} defaultValue={30} className="h-full" minSize={20}>
        <ErrorViewer />
      </Panel>
    </PanelGroup>
  );
}

interface CodeEditorProps {
  tool: Tool;
}

function CodeEditor(props: CodeEditorProps) {
  const { tool } = props;
  const { stagedTool, setStagedTool } = useStagedCode(tool);

  const { validatePython } = usePythonValidator();

  const [debouncedCode] = useDebouncedValue(stagedTool.source_code || '', 500);

  const debouncedSetStagedTool = useDebouncedCallback(setStagedTool, 500);
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

  const [localCode, setLocalCode] = useState<string>(
    stagedTool.source_code || '',
  );

  const handleResetLocalCode = useCallback(() => {
    setLocalCode(tool.source_code || '');
  }, [tool.source_code]);

  useEffect(() => {
    document.addEventListener('resetStagedTool', handleResetLocalCode);

    return () => {
      document.removeEventListener('resetStagedTool', handleResetLocalCode);
    };
  }, [handleResetLocalCode]);

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
        language="python"
        code={localCode}
      />
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

  const alignJSONSchemaWithTool = useCallback(() => {
    setJsonSchemaString(
      JSON.stringify(
        generateJSONSchemaFromCode(
          stagedTool.source_code || '',
          stagedTool.json_schema as ToolJSONSchema,
        ) || '',
        null,
        2,
      ),
    );
  }, [setJsonSchemaString, stagedTool.source_code, stagedTool.json_schema]);

  const hasDescriptionPlaceholder = useMemo(() => {
    if (!parsedJsonSchema) {
      return false;
    }

    return Object.values(
      get(parsedJsonSchema, 'parameters.properties', {}),
    ).some((arg) => arg.description === ADD_DESCRIPTION_PLACEHOLDER);
  }, [parsedJsonSchema]);

  const errorMessage = useMemo(() => {
    if (parsingError) {
      return parsingError;
    }

    if (isDifferent) {
      return t('JSONSchemaViewer.different');
    }

    if (hasDescriptionPlaceholder) {
      return t('JSONSchemaViewer.descriptionPlaceholder');
    }

    return null;
  }, [parsingError, t, isDifferent, hasDescriptionPlaceholder]);

  return (
    <VStack fullHeight fullWidth borderLeft>
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
              label={t('JSONSchemaViewer.fix')}
              onClick={alignJSONSchemaWithTool}
            />
          )}
        </HStack>
      )}
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

function JSONViewer() {
  const tool = useCurrentTool();
  const isMobile = useIsMobile();

  if (!tool) {
    return null;
  }

  return (
    <PanelGroup
      className="h-full w-full"
      direction="horizontal"
      autoSaveId="json-viewer"
    >
      <Panel defaultSize={50} defaultValue={50} className="h-full" minSize={20}>
        <CodeEditor tool={tool} />
      </Panel>
      <PanelResizeHandle
        className={isMobile ? 'h-[1px] w-full bg-border' : 'w-[1px] h-full'}
      />
      <Panel defaultSize={50} defaultValue={50} className="h-full" minSize={20}>
        <JSONSchemaViewer key={tool.id} tool={tool} />
      </Panel>
    </PanelGroup>
  );
}

type EditMode = 'code' | 'codeAndSimulator' | 'errors' | 'json' | 'settings';

function EditModes() {
  const { mode, setMode } = useEditMode();
  const { error } = useToolErrors();
  const t = useTranslations('ToolsEditor/LocalToolsViewer');
  const { isDifferent } = useIsCodeAndSchemaDifferent();

  return (
    <RawToggleGroup
      vertical
      label={t('EditModes.label')}
      hideLabel
      value={mode}
      onValueChange={(value) => {
        if (!value) {
          return;
        }
        setMode(value as EditMode);
      }}
      size="small"
      items={[
        {
          hideLabel: true,
          icon: <CodeIcon />,
          label: t('EditModes.modes.code'),
          value: 'code',
        },
        {
          hideLabel: true,
          icon: <SplitscreenRightIcon />,
          label: t('EditModes.modes.codeAndSimulator'),
          value: 'codeAndSimulator',
        },
        {
          hideLabel: true,
          icon: <CogIcon />,
          label: t('EditModes.modes.settings'),
          value: 'settings',
        },
        {
          hideLabel: true,
          icon: (
            <WrapNotificationDot disabled={!isDifferent}>
              <DataObjectIcon />
            </WrapNotificationDot>
          ),
          label: t('EditModes.modes.json'),
          value: 'json',
        },
        {
          hideLabel: true,
          icon: (
            <WrapNotificationDot disabled={!error}>
              <ErrorIcon />
            </WrapNotificationDot>
          ),
          label: t('EditModes.modes.errors'),
          value: 'errors',
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
      mutate({
        toolId: tool.id || '',
        requestBody: {
          description: get(stagedTool.json_schema, 'description', '') as string,
          json_schema: stagedTool.json_schema,
          source_code: stagedTool.source_code || '',
          return_char_limit: stagedTool.return_char_limit,
        },
      });
    }
  }, [isDirty, mutate, stagedTool, tool.id]);
  const hasNameChanged = useHasNameChanged();

  return (
    <Button
      label={t('SaveToolButton.label')}
      color="primary"
      busy={isPending}
      onClick={handleSubmit}
      preIcon={<SaveIcon />}
      size="small"
      disabled={!isDirty || hasNameChanged}
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
      <RestoreToolButton />
      <SchemaChangeWarning />

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
    case 'code':
      return (
        <PanelGroup
          /* eslint-disable-next-line react/forbid-component-props */
          className="h-full w-full"
          direction="horizontal"
          autoSaveId="code-editor"
        >
          <Panel
            defaultSize={100}
            defaultValue={100}
            className="h-full"
            minSize={100}
          >
            <CodeEditor tool={tool} />
          </Panel>
        </PanelGroup>
      );
    case 'codeAndSimulator':
      return <CodeAndSimulator />;
    case 'errors':
      return <CodeAndError />;
    case 'json':
      return <JSONViewer />;
    case 'settings':
      return <LocalToolSettings />;
    default:
      return null;
  }
}

function useHasNameChanged() {
  const tool = useCurrentTool();
  const { stagedTool } = useStagedCode(tool);
  const pythonMetadata = useMemo(() => {
    return pythonCodeParser(stagedTool.source_code || '');
  }, [stagedTool.source_code]);

  const lastFunction = useMemo(() => {
    // the last function is the main function in our code
    return pythonMetadata[pythonMetadata.length - 1];
  }, [pythonMetadata]);

  return tool?.name !== lastFunction?.name;
}

function useIsCodeAndSchemaDifferent() {
  const tool = useCurrentTool();
  const { stagedTool } = useStagedCode(tool);

  const codeSchema = useMemo(() => {
    return stagedTool.json_schema;
  }, [stagedTool.json_schema]);

  const pythonMetadata = useMemo(() => {
    return pythonCodeParser(stagedTool.source_code || '');
  }, [stagedTool.source_code]);

  const lastFunction = useMemo(() => {
    // the last function is the main function in our code
    return pythonMetadata[pythonMetadata.length - 1];
  }, [pythonMetadata]);

  const isDifferent = useMemo(() => {
    // the last function is the main function in our code

    if (!lastFunction) {
      return false;
    }

    const schemaFunctionName = get(codeSchema, 'name', '');
    const schemaDescription = get(codeSchema, 'description', '');
    const args = get(
      codeSchema,
      'parameters.properties',
      {},
    ) as ToolJSONSchema['parameters']['properties'];

    const baseArgs = Object.entries(args)
      .filter(([key]) => key !== 'request_heartbeat')
      .map(([key, value]) => [
        key,
        jsonSchemaTypeMap[value.type] || value.type,
      ]);

    const lastFunctionArgs = lastFunction.args.map((arg) => [
      arg.name,
      jsonSchemaTypeMap[arg.type] || arg.type,
    ]);

    return (
      lastFunction.name !== schemaFunctionName ||
      lastFunction.description !== schemaDescription ||
      !isEqual(baseArgs, lastFunctionArgs)
    );
  }, [lastFunction, codeSchema]);

  return {
    isDifferent,
    lastFunction,
  };
}

function SchemaChangeWarning() {
  const t = useTranslations('ToolsEditor/LocalToolsViewer');

  const { isDifferent, lastFunction } = useIsCodeAndSchemaDifferent();

  const hasNameChanged = useHasNameChanged();
  const { setMode } = useEditMode();

  const navigateToJSONViewer = useCallback(() => {
    setMode('json');
  }, [setMode]);

  if (hasNameChanged) {
    return (
      <Tooltip asChild content={t('SchemaChangeWarning.nameRestriction')}>
        <Badge
          size="large"
          preIcon={<WarningIcon />}
          content={t('SchemaChangeWarning.nameRestrictionTitle')}
          variant="destructive"
        />
      </Tooltip>
    );
  }

  if (!isDifferent) {
    return null;
  }

  return (
    <Tooltip
      asChild
      content={t('SchemaChangeWarning.title', {
        functionName: lastFunction.name,
      })}
    >
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

function LocalToolSettings() {
  const tool = useCurrentTool();
  const { stagedTool, setStagedTool } = useStagedCode(tool);

  const t = useTranslations('ToolsEditor/LocalToolsViewer');

  const handleReturnCharLimitChange = useCallback(
    (value: string) => {
      setStagedTool((prev) => ({
        ...prev,
        // @ts-expect-error - we want to do a hacky cast here because we can throw an error if the value is not a number
        return_char_limit: value as number,
      }));
    },
    [setStagedTool],
  );

  return (
    <VStack padding fullWidth fullHeight>
      <RawInput
        fullWidth
        label={t('LocalToolSettings.returnCharLimit.label')}
        value={stagedTool.return_char_limit}
        onChange={(e) => {
          handleReturnCharLimitChange(e.target.value);
        }}
      />
      <HStack>
        <DeleteToolButton currentToolId={tool.id || ''} />
      </HStack>
    </VStack>
  );
}

interface LocalToolsViewerProps {
  tool: Tool;
}

export function LocalToolViewer(props: LocalToolsViewerProps) {
  const { tool } = props;

  const { tools } = useCurrentAgent();

  const isAttached = useMemo(() => {
    return tools?.some((t) => t.id === tool.id);
  }, [tools, tool.id]);

  return (
    <CurrentToolProvider tool={tool}>
      <VStack gap={false} fullWidth fullHeight>
        <ToolActionsHeader
          idToAttach={tool.id || ''}
          attachedId={isAttached ? tool.id : undefined}
          type={tool.tool_type || 'custom'}
          name={tool.name || ''}
          actions={<ToolActions tool={tool} />}
        />
        <HStack collapseHeight fullWidth flex gap={false}>
          <VStack collapseWidth flex fullHeight>
            <ToolContent />
          </VStack>
          <VStack
            borderLeft
            fullHeight
            padding="xxsmall"
            color="background-grey"
          >
            <EditModes />
          </VStack>
        </HStack>
      </VStack>
    </CurrentToolProvider>
  );
}
