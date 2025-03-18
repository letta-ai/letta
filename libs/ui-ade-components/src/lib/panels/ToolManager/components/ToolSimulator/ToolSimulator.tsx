import { useToolsServiceRunToolFromSource } from '@letta-cloud/sdk-core';
import type { Tool } from '@letta-cloud/sdk-core';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { z } from 'zod';
import { Debugger, TerminalIcon } from '@letta-cloud/ui-component-library';
import { useStagedCode } from '../../hooks/useStagedCode/useStagedCode';

interface ToolSimulatorProps {
  tool: Tool;
}

export function ToolSimulator(props: ToolSimulatorProps) {
  const { tool } = props;

  const { stagedTool } = useStagedCode(tool);
  const [completedAt, setCompletedAt] = useState<number | null>(null);

  const code = useMemo(() => {
    return stagedTool?.source_code || '';
  }, [stagedTool?.source_code]);

  const t = useTranslations('ToolsEditor/LocalToolsViewer');

  const { mutate, error, submittedAt, reset, data, isPending } =
    useToolsServiceRunToolFromSource();

  const inputConfig = useMemo(
    () => ({
      defaultInput: {},
      schema: z.record(z.string(), z.any()),
      inputLabel: t('ToolSimulator.inputLabel'),
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

  return (
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
            label: t('ToolSimulator.outputLabel'),
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
      label={t('ToolSimulator.label')}
    />
  );
}
