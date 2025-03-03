'use client';
import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { RawInputContainer } from '../Form/Form';
import type { z } from 'zod';
import { useTranslations } from '@letta-cloud/translations';
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
  props: DebuggerInputProps<InputSchema>,
) {
  const { inputConfig, isRunning, onRun } = props;
  const t = useTranslations('ui-component-library/Debugger');
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
              color="secondary"
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
  output?: Output;
}

function DebuggerOutput(props: DebuggerOutputProps) {
  const { output } = props;
  const t = useTranslations('ui-component-library/Debugger');

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

  const [activeTab, setActiveTab] = useState(output?.responses[0]?.value);

  return (
    <VStack collapseHeight gap={false} flex fullWidth>
      <HStack
        borderX
        className="h-[38px]"
        fullWidth
        justify="spaceBetween"
        gap={false}
      >
        <VStack fullHeight justify="end">
          <TabGroup
            fullWidth
            upperCase
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value);
            }}
            items={
              output?.responses?.map((response) => ({
                label: response.label,
                value: response.value,
                icon: response.icon,
              })) || []
            }
          />
        </VStack>
        <div className="pr-2 flex items-center h-full">{statusBadge}</div>
      </HStack>
      <VStack overflowY="auto" flex fullWidth>
        <Code
          color="background-grey"
          fullHeight
          flex
          fontSize="small"
          language="javascript"
          code={
            output?.responses.find((r) => r.value === activeTab)?.content || ''
          }
          showLineNumbers={false}
        />
      </VStack>
    </VStack>
  );
}

interface Output {
  status?: 'error' | 'success' | undefined;
  duration?: number | undefined;
  responses: Array<{
    label: string;
    value: string;
    icon?: React.ReactNode;
    content?: string | undefined;
  }>;
}

interface DebuggerProps<InputSchema extends GenericSchema> {
  onRun: (input: z.infer<InputSchema>) => void;
  inputConfig: InputConfig<InputSchema>;
  isRunning?: boolean;
  output: Output;
  label: string;
  hideLabel?: boolean;
  preLabelIcon?: React.ReactNode;
}

export function Debugger<InputSchema extends GenericSchema>(
  props: DebuggerProps<InputSchema>,
) {
  const {
    inputConfig,
    hideLabel,
    isRunning,
    output,
    onRun,
    preLabelIcon,
    label,
  } = props;

  return (
    <HStack className="min-h-[300px]" flex fullWidth>
      <RawInputContainer
        fullWidth
        hideLabel={hideLabel}
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
          <DebuggerOutput output={output} />
        </VStack>
      </RawInputContainer>
    </HStack>
  );
}
