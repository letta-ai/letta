import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import type { MCPTool } from '@letta-cloud/sdk-core';
import {
  Button,
  CodeIcon,
  HStack,
  PlayIcon,
  ResizableKeyValueEditor,
  VStack,
  Typography,
  Code,
  type ResizableKeyValueEditorDefinition,
  DataObjectIcon,
  LoadingEmptyStatusComponent,
  Badge,
  Tooltip,
  ToolsIcon,
  RawSwitch,
} from '@letta-cloud/ui-component-library';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useExecuteMCPTool } from '../hooks/useExecuteMCPTool';
import { useCurrentAgent } from '../../../../../hooks';
import { parseMCPTool } from '../utils';

interface MCPToolInputProps {
  tool: MCPTool;
  serverName: string;
  onRunTool: (args: Record<string, unknown>) => void;
  isToolRunning?: boolean;
}

function MCPToolInput(props: MCPToolInputProps) {
  const { tool: mcpTool, onRunTool, isToolRunning } = props;
  const t = useTranslations('ToolManager/MCPToolSimulator');

  // Parse the SDK tool to get properly typed version
  const tool = useMemo(() => parseMCPTool(mcpTool), [mcpTool]);

  const defaultArguments = useMemo(() => {
    if (!tool.inputSchema?.properties) {
      return [];
    }

    const { properties, required = [] } = tool.inputSchema;

    return Object.entries(properties).map(([key, parameter]) => {
      const isRequired = required.includes(key);
      const { description, enum: enumValues, type, default: defaultValue } = parameter;

      const keyBadgeContent = (
        <HStack gap align="center">
          {isRequired ? (
            <Badge content="Required" size="small" variant="warning" />
          ) : null}
          {type ? (
            <Typography variant="body3" font="mono" color="muted">
              {type}
            </Typography>
          ) : null}
        </HStack>
      );

      const keyBadge = (type || isRequired) ? (
        description ? (
          <Tooltip content={description}>
            {keyBadgeContent}
          </Tooltip>
        ) : (
          keyBadgeContent
        )
      ) : undefined;


      const valuePlaceholder = description
        ? `${description}${enumValues?.length ? ` (${enumValues.join(', ')})` : ''}`
        : ' ';

      return {
        key,
        value: defaultValue ?? '',
        disableKeyInput: true,
        keyBadge,
        valuePlaceholder,
      };
    });
  }, [tool]);

  const [stagedArguments, setStagedArguments] = useState<
    ResizableKeyValueEditorDefinition[]
  >(defaultArguments);

  useEffect(() => {
    setStagedArguments(defaultArguments);
  }, [defaultArguments]);

  // TODO: @jnjpng refactor this to be all in a form context and avoid button madness
  const handleRunTool = useCallback(() => {
    const args: Record<string, unknown> = stagedArguments.reduce(
      (acc, arg) => {
        if (arg.key && arg.value) {
          try {
            // Try to parse as JSON first
            acc[arg.key] = JSON.parse(arg.value);
          } catch {
            // If not valid JSON, use as string
            acc[arg.key] = arg.value;
          }
        }
        return acc;
      },
      {} as Record<string, unknown>
    );

    onRunTool(args);
  }, [onRunTool, stagedArguments]);

  return (
    <VStack
      gap={false}
      overflow="hidden"
      color="background"
      fullWidth
      fullHeight
    >
      <HStack fullWidth justify="spaceBetween">
        <VStack padding="small">
          <HStack>
            <ToolsIcon />
            <Typography variant="body2" bold>
            {tool.name}
          </Typography>
          </HStack>
          {tool.description && (
            <Typography variant="body2" color="muted">
              {tool.description}
            </Typography>
          )}
        </VStack>
        <VStack padding="small">
          <Button
            label={t('ToolInput.run')}
            size="small"
            onClick={handleRunTool}
            busy={isToolRunning}
            preIcon={<PlayIcon />}
            color="tertiary"
          />
        </VStack>
      </HStack>
      <HStack
        align="center"
        justify="spaceBetween"
        color="background"
        borderTop
        borderBottom
        padding="small"
        gap="text"
      >
        <HStack>
          <CodeIcon />
          <Typography variant="body3" bold>
            {t('ToolInput.title')}
          </Typography>
        </HStack>
      </HStack>
      <VStack collapseHeight flex overflowY="auto">
        {defaultArguments.length > 0 ? (
          <ResizableKeyValueEditor
            definitions={stagedArguments}
            disableKeyInput
            disableNewDefinition
            disableDeleteDefinition
            setDefinitions={setStagedArguments}
            width={30}
          />
        ) : (
          <HStack fullHeight fullWidth align="center" justify="center">
            <Typography variant="body2" color="muted">
              {t('ToolInput.noParameters')}
            </Typography>
          </HStack>
        )}
      </VStack>
    </VStack>
  );
}

interface MCPToolOutputProps {
  response?: unknown;
  error?: string;
  isToolRunning?: boolean;
}

function MCPToolOutput(props: MCPToolOutputProps) {
  const { response, error, isToolRunning } = props;
  const t = useTranslations('ToolManager/MCPToolSimulator');
  const [isRaw, setIsRaw] = useState(false);

  const { outputContent, language } = useMemo(() => {
    if (error) {
      // Fallback to text if there's an error
      return { outputContent: error, language: 'text' as const };
    }
    if (response) {
      let processedResponse = response;

      if (!isRaw) {
        // Check if response has a result property that's a string
        if (typeof response === 'object' && response !== null && 'result' in response) {
          const responseObj = response as { result: unknown; success?: boolean; [key: string]: unknown };

          // If result is a string, try to parse it as JSON
          if (typeof responseObj.result === 'string') {
            try {
              const parsedResult = JSON.parse(responseObj.result);
              processedResponse = {
                ...responseObj,
                result: parsedResult
              };
            } catch {
              // If parsing fails and the string has newlines, we'll display as xml
              if (responseObj.result.includes('\n')) {
                return {
                  outputContent: responseObj.result,
                  language: 'xml' as const
                };
              }
              processedResponse = response;
            }
          }
        }
      }

      return {
        outputContent: JSON.stringify(processedResponse, null, 2),
        language: 'javascript' as const
      };
    }
    return { outputContent: '', language: 'javascript' as const };
  }, [error, response, isRaw]);

  return (
    <VStack fullHeight fullWidth flex color="background">
      <HStack
        align="center"
        justify="spaceBetween"
        color="background"
        borderBottom
        gap="text"
      >
        <HStack fullWidth align="start" justify="spaceBetween">
          <HStack padding="small">
            <DataObjectIcon/>
            <Typography variant="body2" bold>
              {t('ToolOutput.title')}
            </Typography>
          </HStack>
          <VStack fullHeight align="center" paddingRight="medium" paddingTop="medium">
            <RawSwitch
              size="small"
              labelFontVariant="body2"
              label="Raw"
              checked={isRaw}
              onCheckedChange={setIsRaw}
            />
          </VStack>
        </HStack>
      </HStack>
      <VStack collapseHeight flex overflowY="auto">
        {isToolRunning ? (
          <LoadingEmptyStatusComponent
            isLoading={true}
            loaderVariant="spinner"
          />
        ) : !response && !error ? (
          <HStack fullHeight fullWidth align="center" justify="center">
            <Typography variant="body2" color="muted">
              {t('ToolOutput.noOutput')}
            </Typography>
          </HStack>
        ) : (
          <VStack paddingLeft="xxsmall">
            <Code
              variant="minimal"
              border={false}
              showLineNumbers={false}
              fontSize="small"
              language={language}
              code={outputContent}
            />
          </VStack>
        )}
      </VStack>
    </VStack>
  );
}

interface MCPToolSimulatorProps {
  tool: MCPTool | null;
  serverName: string;
}

export function MCPToolSimulator(props: MCPToolSimulatorProps) {
  const { tool: mcpTool, serverName } = props;
  const t = useTranslations('ToolManager/MCPToolSimulator');
  const { id: agentId } = useCurrentAgent();

  const { mutate, data, error, isPending, reset } = useExecuteMCPTool();

  // Parse the SDK tool to get properly typed version
  const tool = useMemo(() => mcpTool ? parseMCPTool(mcpTool) : null, [mcpTool]);

  const handleRunTool = useCallback(
    (args: Record<string, unknown>) => {
      if (!tool) return;

      reset();
      mutate({
        mcpServerName: serverName,
        toolName: tool.name,
        requestBody: {
          args,
        },
        userId: agentId,
      });
    },
    [tool, serverName, mutate, reset, agentId]
  );

  if (!mcpTool || !tool) {
    return (
      <VStack fullHeight fullWidth align="center" justify="center" color="background-grey">
        <Typography variant="body2" color="muted">
          {t('selectTool')}
        </Typography>
      </VStack>
    );
  }

  return (
    <PanelGroup direction="vertical" className="h-full w-full">
      <Panel defaultSize={50} minSize={20}>
        <MCPToolInput
          tool={mcpTool}
          serverName={serverName}
          isToolRunning={isPending}
          onRunTool={handleRunTool}
        />
      </Panel>
      <PanelResizeHandle className="h-[1px] w-full bg-border" />
      <Panel defaultSize={50} minSize={20}>
        <MCPToolOutput
          response={data}
          error={error ? (error instanceof Error ? error.message : JSON.stringify(error)) : undefined}
          isToolRunning={isPending}
        />
      </Panel>
    </PanelGroup>
  );
}
