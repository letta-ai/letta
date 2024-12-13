'use client';
import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { RawInputContainer } from '../Form/Form';
import type { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { Code } from '../Code/Code';
import { Button } from '../Button/Button';
import { CheckIcon, PlayIcon, WarningIcon } from '../../icons';
import { Typography } from '../Typography/Typography';
import { TabGroup } from '../TabGroup/TabGroup';

interface HeaderProps {
  label: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}
function Header(props: HeaderProps) {
  const { label, badge, actions } = props;

  return (
    <HStack
      borderX
      className="h-[38px]"
      paddingX="xsmall"
      fullWidth
      justify="spaceBetween"
      align="center"
    >
      <Typography bold uppercase variant="body2">
        {label}
      </Typography>
      <HStack align="center">
        {badge}
        {actions}
      </HStack>
    </HStack>
  );
}

type GenericSchema = z.Schema<any, any>;

interface InputConfig<InputSchema extends GenericSchema> {
  schema: InputSchema;
  inputLabel: string;
  defaultInput?: z.infer<InputSchema>;
  inputPlaceholder?: string;
  runLabel?: string;
}

interface DebuggerInputProps<InputSchema extends GenericSchema> {
  onRun: (input: z.infer<InputSchema>) => void;
  inputConfig: InputConfig<InputSchema>;
  isRunning?: boolean;
}

function DebuggerInput<InputSchema extends GenericSchema>(
  props: DebuggerInputProps<InputSchema>
) {
  const { inputConfig, isRunning, onRun } = props;
  const t = useTranslations('component-library/Debugger');
  const { schema: inputSchema } = inputConfig;
  const { inputLabel, defaultInput, inputPlaceholder, runLabel } = inputConfig;
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [code, setCode] = React.useState(JSON.stringify(defaultInput, null, 2));

  const handleSubmit = useCallback(() => {
    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(code);
    } catch (_e) {
      setErrorMessage(t('invalidJSON'));
      return;
    }

    const parsed = inputSchema.safeParse(parsedJson);

    if (!parsed.success) {
      setErrorMessage(parsed.error.errors[0].message);
      return;
    }

    onRun(parsed.data);
  }, [code, inputSchema, onRun, t]);

  useEffect(() => {
    setErrorMessage(null);
  }, [code]);

  return (
    <VStack collapseHeight gap={false} flex fullWidth>
      <Header
        label={inputLabel}
        actions={
          <HStack align="center">
            <Typography variant="body2" color="destructive">
              {errorMessage}
            </Typography>
            <Button
              preIcon={<PlayIcon />}
              size="small"
              busy={isRunning}
              onClick={handleSubmit}
              color="tertiary"
              label={runLabel || t('run')}
              type="button"
            />
          </HStack>
        }
      />
      <VStack overflowY="auto" flex fullWidth>
        <Code
          fullHeight
          flex
          placeholder={inputPlaceholder || t('inputPlaceholder')}
          showLineNumbers
          language="javascript"
          code={code}
          fontSize="small"
          onSetCode={setCode}
        />
      </VStack>
    </VStack>
  );
}

interface DebuggerOutputProps {
  outputConfig: OutputConfig;
  output?: Output;
}

function DebuggerOutput(props: DebuggerOutputProps) {
  const { outputConfig, output } = props;
  const t = useTranslations('component-library/Debugger');

  const statusBadge = useMemo(() => {
    if (output?.status) {
      if (output.status === 'error') {
        return (
          <Typography
            className="animate-in fade-in whitespace-nowrap flex items-center gap-1"
            variant="body2"
            color="destructive"
          >
            <WarningIcon />
            {t('error')}
          </Typography>
        );
      }

      if (output.status === 'success') {
        return (
          <Typography
            className="animate-in fade-in whitespace-nowrap flex items-center gap-1"
            variant="body2"
            color="positive"
          >
            <CheckIcon />
            {t('success')}
          </Typography>
        );
      }
    }

    return null;
  }, [output, t]);

  type TabKey = 'stderr' | 'stdout' | 'tool-output';

  const tabConfig = useMemo(
    () =>
      ({
        stderr: {
          label: 'stderr',
          content: output?.stderr,
        },
        stdout: {
          label: 'stdout',
          content: output?.stdout,
        },
        'tool-output': {
          label: outputConfig.label,
          content: output?.value,
        },
      } as const),
    [output, outputConfig.label]
  );

  const [activeTab, setActiveTab] = useState<TabKey>('tool-output');

  const getTabItems = useCallback(() => {
    return (
      Object.entries(tabConfig) as Array<
        [TabKey, { label: string; content?: string }]
      >
    ).map(([value, { label }]) => ({
      label,
      value,
    }));
  }, [tabConfig]);

  return (
    <VStack collapseHeight gap={false} flex fullWidth>
      <HStack
        borderX
        className="h-[38px]"
        fullWidth
        justify="spaceBetween"
        gap={false}
      >
        <TabGroup
          fullWidth
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value as TabKey);
          }}
          items={getTabItems()}
        />
        <div className="pr-2 flex items-center h-full">{statusBadge}</div>
      </HStack>
      <VStack overflowY="auto" flex fullWidth>
        <Code
          color="background-grey"
          fullHeight
          flex
          fontSize="small"
          language="javascript"
          code={tabConfig[activeTab].content || ''}
          showLineNumbers={false}
        />
      </VStack>
    </VStack>
  );
}

interface OutputConfig {
  label: string;
}

interface Output {
  status: 'error' | 'success' | undefined;
  duration: number;
  value: string;
  stdout: string;
  stderr: string;
}

interface DebuggerProps<InputSchema extends GenericSchema> {
  onRun: (input: z.infer<InputSchema>) => void;
  inputConfig: InputConfig<InputSchema>;
  outputConfig: OutputConfig;
  isRunning?: boolean;
  output?: Output | undefined;
  label: string;
  preLabelIcon?: React.ReactNode;
}

export function Debugger<InputSchema extends GenericSchema>(
  props: DebuggerProps<InputSchema>
) {
  const {
    inputConfig,
    isRunning,
    outputConfig,
    output,
    onRun,
    preLabelIcon,
    label,
  } = props;

  return (
    <HStack className="min-h-[300px]" flex fullWidth>
      <RawInputContainer
        fullWidth
        flex
        preLabelIcon={preLabelIcon}
        label={label}
      >
        <VStack
          borderTop
          overflow="hidden"
          collapseHeight
          flex
          fullWidth
          gap={false}
        >
          <DebuggerInput
            isRunning={isRunning}
            onRun={onRun}
            inputConfig={inputConfig}
          />
          <DebuggerOutput output={output} outputConfig={outputConfig} />
        </VStack>
      </RawInputContainer>
    </HStack>
  );
}
