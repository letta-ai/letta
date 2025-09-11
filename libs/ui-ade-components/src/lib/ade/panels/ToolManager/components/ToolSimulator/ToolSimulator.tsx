import { useToolsServiceRunToolFromSource } from '@letta-cloud/sdk-core';
import type {
  Tool,
  ToolReturnMessage,
  ToolRunFromSource,
} from '@letta-cloud/sdk-core';
import { zodTypes } from '@letta-cloud/sdk-core';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import type {
  ResizableKeyValueEditorDefinition,
  SupportedLangauges,
} from '@letta-cloud/ui-component-library';
import { PublishIcon } from '@letta-cloud/ui-component-library';
import { CheckIcon } from '@letta-cloud/ui-component-library';
import {
  Code,
  HistoryIcon,
  InfoIcon,
  Popover,
  Typography,
  WarningIcon,
} from '@letta-cloud/ui-component-library';
import {
  Button,
  CodeIcon,
  HStack,
  PlayIcon,
  ResizableKeyValueEditor,
  TabGroup,
  TerminalIcon,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useStagedCode } from '../../hooks/useStagedCode/useStagedCode';
import {
  useCurrentAgent,
  useSyncUpdateCurrentAgent,
} from '../../../../../hooks';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

interface ArgumentEditorProps {
  defaultArguments: ResizableKeyValueEditorDefinition[];
  stagedArguments: ResizableKeyValueEditorDefinition[];
  setStagedArguments: React.Dispatch<
    React.SetStateAction<ResizableKeyValueEditorDefinition[]>
  >;
}

function ArgumentEditor(props: ArgumentEditorProps) {
  const { defaultArguments, stagedArguments, setStagedArguments } = props;

  // Compute merged definitions: defaultArguments + stagedArguments, stagedArguments take precedence
  const definitions = useMemo(() => {
    const argMap = new Map<string, ResizableKeyValueEditorDefinition>();

    defaultArguments.forEach((arg) => {
      argMap.set(arg.key, arg);
    });

    stagedArguments.forEach((arg) => {
      argMap.set(arg.key, arg);
    });

    return Array.from(argMap.values());
  }, [defaultArguments, stagedArguments]);

  // Ensure all edits are captured in staged arguments
  const handleSetDefinitions = useCallback(
    (
      newDefinitions:
        | ResizableKeyValueEditorDefinition[]
        | ((
            prev: ResizableKeyValueEditorDefinition[],
          ) => ResizableKeyValueEditorDefinition[]),
    ) => {
      if (typeof newDefinitions === 'function') {
        setStagedArguments(() => {
          const currentDefinitions = definitions;
          return newDefinitions(currentDefinitions);
        });
      } else {
        setStagedArguments(newDefinitions);
      }
    },
    [definitions, setStagedArguments],
  );

  return (
    <VStack>
      <ResizableKeyValueEditor
        definitions={definitions}
        disableKeyInput
        disableNewDefinition
        disableDeleteDefinition
        setDefinitions={handleSetDefinitions}
      />
    </VStack>
  );
}

function HowToUseEnvironmentVariables() {
  const t = useTranslations('ToolsEditor/ToolsSimulator');
  return (
    <Popover
      triggerAsChild
      align="start"
      trigger={
        <Button
          size="xsmall"
          color="tertiary"
          label={t('HowToUseEnvironmentVariables.trigger')}
          preIcon={<InfoIcon />}
        />
      }
    >
      <HStack padding="small">
        <Typography variant="body2">
          {t('HowToUseEnvironmentVariables.description')}
        </Typography>
      </HStack>
      <Code
        showLineNumbers={false}
        fontSize="small"
        language="python"
        code={`import os

# ...the rest of your code

your_variable = os.getenv('YOUR_VARIABLE_HERE')
`}
      />
    </Popover>
  );
}

interface UpdateAgentEnvironmentValueProps {
  value: string;
  keyValue: string;
}

function UpdateAgentEnvironmentValue(props: UpdateAgentEnvironmentValueProps) {
  const { value, keyValue: key } = props;

  const t = useTranslations('ToolsEditor/ToolsSimulator');

  const { isUpdating, isDebouncing, syncUpdateCurrentAgent } =
    useSyncUpdateCurrentAgent();

  const { id: agentId } = useCurrentAgent();
  const { tool_exec_environment_variables } = useCurrentAgent();

  const existingVar = useMemo(() => {
    return (tool_exec_environment_variables || []).find(
      (variable) => variable.key === key,
    );
  }, [key, tool_exec_environment_variables]);

  const handleUpdate = useCallback(() => {
    syncUpdateCurrentAgent((oldData) => {
      const existingVar = oldData.tool_exec_environment_variables || [];
      let isAdded = false;

      const toolVariables = existingVar.map((variable) => {
        if (variable.key === key) {
          isAdded = true;
          return {
            ...variable,
            value,
          };
        }
        return variable;
      });

      if (!isAdded) {
        toolVariables.push({
          key,
          value,
          agent_id: agentId,
        });
      }

      return {
        ...oldData,
        tool_exec_environment_variables: toolVariables,
      };
    });
  }, [key, syncUpdateCurrentAgent, agentId, value]);

  const isDifferentOrNew = useMemo(() => {
    if (!existingVar) {
      return true;
    }
    return existingVar.value !== value;
  }, [existingVar, value]);

  if (!isDifferentOrNew) {
    return null;
  }

  return (
    <Button
      label={t('UpdateAgentEnvironmentValue.label')}
      size="xsmall"
      color="tertiary"
      square
      onClick={handleUpdate}
      hideLabel
      preIcon={<PublishIcon />}
      busy={isUpdating || isDebouncing}
    />
  );
}

interface EnvironmentEditorProps {
  defaultEnvironment: ResizableKeyValueEditorDefinition[];
  stagedEnvironment: ResizableKeyValueEditorDefinition[];
  setStagedEnvironment: React.Dispatch<
    React.SetStateAction<ResizableKeyValueEditorDefinition[]>
  >;
}

function EnvironmentEditor(props: EnvironmentEditorProps) {
  const { defaultEnvironment, stagedEnvironment, setStagedEnvironment } = props;

  const t = useTranslations('ToolsEditor/ToolsSimulator');

  const restoreEnvironmentDefinition = useCallback(
    (definition: ResizableKeyValueEditorDefinition) => {
      setStagedEnvironment((prev) => {
        return prev.map((variable) => {
          if (variable.key === definition.key) {
            return {
              ...variable,
              value: definition.value,
            };
          }
          return variable;
        });
      });
    },
    [setStagedEnvironment],
  );

  const parsedEnvironment: ResizableKeyValueEditorDefinition[] = useMemo(() => {
    const defaultEnvironmentKeyValueMap = new Map(
      defaultEnvironment.map((variable) => [variable.key, variable]),
    );

    return stagedEnvironment.map((variable) => {
      const existingVar = defaultEnvironmentKeyValueMap.get(variable.key);

      const isValueOverridden =
        existingVar && existingVar?.value !== variable.value;

      return {
        key: variable.key,
        value: variable.value,
        disableDelete: !!existingVar,
        disableKeyInput: !!existingVar,
        valueBadge: (
          <HStack>
            <UpdateAgentEnvironmentValue
              value={variable.value}
              keyValue={variable.key}
            />
            {isValueOverridden ? (
              <Button
                size="xsmall"
                color="tertiary"
                hideLabel
                square
                label={t('restore')}
                preIcon={<HistoryIcon />}
                onClick={() => {
                  restoreEnvironmentDefinition(existingVar);
                }}
              ></Button>
            ) : undefined}
          </HStack>
        ),
      };
    });
  }, [defaultEnvironment, restoreEnvironmentDefinition, stagedEnvironment, t]);

  return (
    <ResizableKeyValueEditor
      actions={<HowToUseEnvironmentVariables />}
      definitions={parsedEnvironment}
      setDefinitions={setStagedEnvironment}
    />
  );
}

interface ToolInputProps {
  defaultArguments: ResizableKeyValueEditorDefinition[];
  onRunTool: (
    args: ToolRunFromSource['args'],
    env: ToolRunFromSource['env_vars'],
  ) => void;
  isToolRunning?: boolean;
}

type ToolInputType = 'args' | 'environment';

function ToolInput(props: ToolInputProps) {
  const { isToolRunning, onRunTool, defaultArguments } = props;

  const { tool_exec_environment_variables } = useCurrentAgent();

  const defaultEnvironment = useMemo(() => {
    return (tool_exec_environment_variables || []).map((variable) => {
      return {
        key: variable.key,
        value: variable.value,
      };
    });
  }, [tool_exec_environment_variables]);

  const [stagedEnvironment, setStagedEnvironment] =
    useState<ResizableKeyValueEditorDefinition[]>(defaultEnvironment);

  const [stagedArguments, setStagedToolArguments] = useState<
    ResizableKeyValueEditorDefinition[]
  >([]);

  const [toolInput, setToolInput] = useState<ToolInputType>('args');

  const handleRunTool = useCallback(() => {
    const args: ToolRunFromSource['args'] = {};

    stagedArguments.forEach((argument) => {
      if (argument.key && argument.value) {
        args[argument.key] = argument.value;
      }
    });

    const env: ToolRunFromSource['env_vars'] = stagedEnvironment.reduce(
      (acc, variable) => {
        if (!variable.key || !variable.value) {
          return acc;
        }

        acc[variable.key] = variable.value;
        return acc;
      },
      {} as Record<string, any>,
    );

    onRunTool(args, env);
  }, [onRunTool, stagedArguments, stagedEnvironment]);

  const t = useTranslations('ToolsEditor/ToolsSimulator');

  return (
    <VStack
      gap={false}
      overflow="hidden"
      color="background"
      fullWidth
      fullHeight
    >
      <HStack
        align="center"
        justify="spaceBetween"
        color="background"
        borderBottom
        padding="xsmall"
        gap="text"
      >
        <TabGroup
          variant="chips"
          size="xxsmall"
          items={[
            {
              label: t('ToolInput.args'),
              value: 'args',
              icon: <CodeIcon />,
            },
            {
              label: t('ToolInput.environment'),
              value: 'environment',
              icon: <TerminalIcon />,
            },
          ]}
          value={toolInput}
          onValueChange={(value) => {
            setToolInput(value as ToolInputType);
          }}
        />
        <HStack>
          <Button
            label={t('ToolInput.run')}
            size="xsmall"
            onClick={handleRunTool}
            busy={isToolRunning}
            preIcon={<PlayIcon />}
            color="tertiary"
            hideLabel={isToolRunning}
          />
        </HStack>
      </HStack>
      <VStack collapseHeight flex overflowY="auto">
        {toolInput === 'args' && (
          <ArgumentEditor
            defaultArguments={defaultArguments}
            stagedArguments={stagedArguments}
            setStagedArguments={setStagedToolArguments}
          />
        )}
        {toolInput === 'environment' && (
          <EnvironmentEditor
            defaultEnvironment={defaultEnvironment}
            stagedEnvironment={stagedEnvironment}
            setStagedEnvironment={setStagedEnvironment}
          />
        )}
      </VStack>
    </VStack>
  );
}

interface ResponseCodeProps {
  code: string;
  language?: SupportedLangauges;
}

function ResponseCode(props: ResponseCodeProps) {
  const { code, language } = props;

  return (
    <VStack>
      <Code
        fullHeight
        variant="minimal"
        border={false}
        showLineNumbers={false}
        fontSize="small"
        language={language || 'typescript'}
        code={code}
      />
    </VStack>
  );
}

type ToolOutputType = 'stderr' | 'stdout' | 'tool_return';

interface ResponseContentProps {
  outputType: ToolOutputType;
  response?: ToolReturnMessage;
  error?: string;
  isToolRunning?: boolean; // Add this prop
}

function ResponseContent(props: ResponseContentProps) {
  const { outputType, error, response, isToolRunning } = props;

  const stdout = useMemo(() => {
    return response?.stdout || [];
  }, [response]);

  const stderr = useMemo(() => {
    return response?.stderr || [];
  }, [response]);

  const t = useTranslations('ToolsEditor/ToolsSimulator');

  if (error) {
    return <ResponseCode language="javascript" code={error} />;
  }

  // Add this condition for running state
  if (isToolRunning) {
    return (
      <HStack fullHeight fullWidth align="center" justify="center">
        <Typography variant="body2" color="muted">
          {t('ToolOutput.runningTool')}
        </Typography>
      </HStack>
    );
  }

  if (!response) {
    return (
      <HStack fullHeight fullWidth align="center" justify="center">
        <Typography variant="body2" color="muted">
          {t('ToolOutput.noOutput')}
        </Typography>
      </HStack>
    );
  }

  if (outputType === 'tool_return') {
    return (
      <ResponseCode
        language="javascript"
        code={
          response?.tool_return
            ? JSON.stringify(response?.tool_return || '', null, 2)
            : ''
        }
      />
    );
  }

  if (outputType === 'stdout') {
    return <ResponseCode language="text" code={stdout.join('\n')} />;
  }

  if (outputType === 'stderr') {
    return <ResponseCode language="text" code={stderr.join('\n')} />;
  }

  return null;
}

interface ToolOutputProps {
  response?: ToolReturnMessage;
  error: string;
  isToolRunning?: boolean; // Add this prop
}

function ToolOutput(props: ToolOutputProps) {
  const { response, error, isToolRunning } = props;
  const t = useTranslations('ToolsEditor/ToolsSimulator');
  const [type, setType] = useState<ToolOutputType>('tool_return');

  const status = useMemo(() => {
    if (error) {
      return 'error' as const;
    }

    if (response) {
      return response.status === 'error'
        ? ('error' as const)
        : ('success' as const);
    }
    return undefined;
  }, [error, response]);

  useEffect(() => {
    if (error) {
      setType('stderr');
    }
  }, [error]);

  return (
    <VStack fullHeight fullWidth flex color="background">
      <HStack padding="xsmall" borderBottom justify="spaceBetween">
        <TabGroup
          variant="chips"
          size="xxsmall"
          items={[
            {
              label: t('ToolOutput.toolReturn'),
              value: 'tool_return',
            },
            {
              label: t('ToolOutput.stdout'),
              value: 'stdout',
            },
            {
              label: t('ToolOutput.stderr'),
              value: 'stderr',
            },
          ]}
          value={type}
          onValueChange={(value) => {
            setType(value as ToolOutputType);
          }}
        />
        <StatusBadge status={status} />
      </HStack>
      <VStack collapseHeight flex overflowY="auto">
        <ResponseContent
          outputType={type}
          error={error}
          response={response}
          isToolRunning={isToolRunning} // Pass the prop
        />
      </VStack>
    </VStack>
  );
}

interface StatusBadgeProps {
  status: 'error' | 'success' | undefined;
}

function StatusBadge(props: StatusBadgeProps) {
  const { status } = props;

  const t = useTranslations('ToolsEditor/ToolsSimulator');
  if (status) {
    if (status === 'error') {
      return (
        <Typography
          className="animate-in fade-in whitespace-nowrap flex items-center gap-1"
          variant="body2"
          color="destructive"
        >
          <WarningIcon />
          {t('StatusBadge.error')}
        </Typography>
      );
    }

    if (status === 'success') {
      return (
        <Typography
          className="animate-in fade-in whitespace-nowrap flex items-center gap-1"
          variant="body2"
          color="positive"
        >
          <CheckIcon />
          {t('StatusBadge.success')}
        </Typography>
      );
    }
  }

  return null;
}

interface ToolSimulatorProps {
  tool: Tool;
}

export function ToolSimulator(props: ToolSimulatorProps) {
  const { tool } = props;

  const { stagedTool } = useStagedCode(tool);

  const code = useMemo(() => {
    return stagedTool?.source_code || '';
  }, [stagedTool?.source_code]);

  const jsonSchema = useMemo(() => {
    const schema = zodTypes.ToolJSONSchema.safeParse(stagedTool?.json_schema);

    if (schema.success) {
      return schema.data;
    }

    return null;
  }, [stagedTool?.json_schema]);

  const argumentParameters = useMemo(() => {
    return Object.entries(jsonSchema?.parameters.properties || {}).map(
      ([key, value]) => {
        return {
          key,
          value: value.default || '',
        };
      },
    );
  }, [jsonSchema]);

  const pipRequirements = useMemo(() => {
    return stagedTool?.pip_requirements || [];
  }, [stagedTool?.pip_requirements]);

  const { mutate, error, reset, data, isPending } =
    useToolsServiceRunToolFromSource();

  const extractedFunctionName = useMemo(() => {
    const nameRegex = /def\s+(\w+)\s*\(/;
    const match = nameRegex.exec(code);

    return match ? match[1] : '';
  }, [code]);

  const handleRun = useCallback(
    (args: ToolRunFromSource['args'], env: ToolRunFromSource['env_vars']) => {
      reset();

      mutate({
        requestBody: {
          name: extractedFunctionName,
          args,
          env_vars: env,
          json_schema: jsonSchema,
          source_code: code,
          pip_requirements: pipRequirements,
          source_type: 'python',
        },
      });
    },
    [code, extractedFunctionName, jsonSchema, mutate, reset, pipRequirements],
  );

  return (
    <VStack color="background-grey" fullWidth fullHeight>
      <PanelGroup direction="vertical">
        <Panel defaultSize={50} minSize={20} maxSize={100}>
          <ToolInput
            defaultArguments={argumentParameters}
            isToolRunning={isPending}
            onRunTool={handleRun}
            key={tool.id}
          />
        </Panel>
        <PanelResizeHandle className="h-[1px] w-full bg-border" />
        <Panel defaultSize={50} minSize={20} maxSize={100}>
          <ToolOutput
            response={data}
            error={error ? JSON.stringify(error, null, 2) : ''}
            isToolRunning={isPending}
          />
        </Panel>
      </PanelGroup>
    </VStack>
  );
}
