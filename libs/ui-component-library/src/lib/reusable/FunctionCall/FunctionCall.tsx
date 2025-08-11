'use client';
import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ContextWindowIcon,
  HeartbeatIcon,
  TerminalIcon,
} from '../../icons';
import { Tooltip } from '../../core/Tooltip/Tooltip';
import { Typography } from '../../core/Typography/Typography';
import { RawCodeEditor } from '../../core/Code/Code';
import { useTranslations } from '@letta-cloud/translations';
import { useCallback, useMemo, useState } from 'react';
import { useAtom } from 'jotai';
import type { ToolReturnMessageSchemaType } from '@letta-cloud/sdk-core';
import { TabGroup } from '../../core/TabGroup/TabGroup';
import { functionCallOpenStatusAtom } from './functionCallOpenStatusAtom';
import { Dialog } from '../../core/Dialog/Dialog';
import { VirtualizedCodeViewer } from '../../core/VirtualizedCodeViewer/VirtualizedCodeViewer';
import { Button } from '../../core/Button/Button';
import { useCopyToClipboard } from '../../hooks';
import { StatusBadge } from '../StatusBadge/StatusBadge';
import { cn } from '@letta-cloud/ui-styles';

interface FunctionCallDataViewerDialogProps {
  content: string;
  trigger?: React.ReactNode;
}

function FunctionCallDataViewerDialog(
  props: FunctionCallDataViewerDialogProps,
) {
  const { content, trigger } = props;

  const t = useTranslations('ui-component-library/FunctionCall');

  const { copyToClipboard } = useCopyToClipboard({
    textToCopy: content,
  });

  return (
    <Dialog
      onConfirm={copyToClipboard}
      confirmText={t('FunctionCallDataViewerDialog.copy')}
      size="xlarge"
      trigger={trigger}
      title={t('response')}
    >
      <div className="min-h-[300px] h-[300px] w-full border">
        <VirtualizedCodeViewer content={content} fontSize="small" />
      </div>
    </Dialog>
  );
}

type FunctionCallVariants = 'default' | 'inspector';

interface FunctionCallProps {
  name: string;
  variant?: FunctionCallVariants;
  inputs: string;
  response?: ToolReturnMessageSchemaType;
  status?: string;
  id: string;
  actions?: React.ReactNode;
}

type ResponseViews = 'response' | 'stderr' | 'stdout';

const FUNCTION_CALL_LIMIT = 10_000;

export function FunctionCall(props: FunctionCallProps) {
  const { id, name, inputs, response, actions, status, variant = 'default' } = props;
  const [openStates, setOpenStates] = useAtom(functionCallOpenStatusAtom);

  const open = useMemo(() => {
    return openStates?.[id] || false;
  }, [id, openStates]);

  const toggleOpen = useCallback(() => {
    setOpenStates((prev) => ({ ...prev, [id]: !open }));
  }, [id, open, setOpenStates]);

  const t = useTranslations('ui-component-library/FunctionCall');

  const toolReturn = response?.tool_return;

  const requestHeartbeatState: boolean | undefined = useMemo(() => {
    // regex to find any form of request_heartbeat = true
    const hasHeartbeatTruePattern = /request_heartbeat[^}]*true/i.test(inputs);
    const hasHeartbeatFalsePattern = /request_heartbeat[^}]*false/i.test(
      inputs,
    );

    if (hasHeartbeatTruePattern) {
      return true;
    }

    if (hasHeartbeatFalsePattern) {
      return false;
    }

    try {
      const parsedInputs = JSON.parse(inputs);
      if ('request_heartbeat' in parsedInputs) {
        return parsedInputs.request_heartbeat === true;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }, [inputs]);

  const [responseView, setResponseView] = useState<ResponseViews>('response');

  const responseData = useMemo(() => {
    switch (responseView) {
      case 'response': {
        const raw = response?.tool_return;

        if (!raw) return raw;

        // Try parse the tool_return as JSON, see if there's a 'message' key
        try {
          const parsed = JSON.parse(raw);
          // If parsed is an object and has 'message' key, return that; otherwise fallback to raw
          if (parsed && typeof parsed === 'object' && 'message' in parsed) {
            return JSON.stringify(parsed.message, null, 2);
          }
          return raw;
        } catch {
          return raw;
        }
      }
      case 'stdout':
        return response?.stdout?.join('\n');
      case 'stderr':
        return response?.stderr?.join('\n');

      default:
        return null;
    }
  }, [response, responseView]);

  const partialResponseData = useMemo(() => {
    if (!responseData) return null;

    // first 10_000 characters

    const first10k = responseData.slice(0, FUNCTION_CALL_LIMIT);

    if (responseData.length >= FUNCTION_CALL_LIMIT) {
      return `${first10k}...`;
    }

    return first10k;
  }, [responseData]);

  return (
    <div className="w-full">
      <HStack
        fullWidth={variant === 'inspector'}
        onClick={toggleOpen}
        gap={false}
      >
        <HStack
          fullWidth={variant === 'inspector'}
          align="center"
          className={cn(variant === 'default' ? 'h-[24px]' : '')}
          gap="small"
        >
          <HStack
            gap="large"
            align="center"
            className={cn(
              variant === 'default'
                ? 'px-2 pr-3 py-1 bg-background text-text-default cursor-pointer border border-grey3'
                : '',
              variant === 'inspector'
                ? 'px-2 pr-3 w-full py-2 border cursor-pointer'
                : '',
            )}
          >
            <HStack gap="small">
              {!open ? (
                <ChevronRightIcon size="xsmall" />
              ) : (
                <ChevronDownIcon size="xsmall" />
              )}
              <TerminalIcon size="small" />
              <Typography bold variant="body3">
                {name}
              </Typography>
            </HStack>
            <StatusBadge status={status} toolReturn={toolReturn} />
          </HStack>
          <HStack align="center" gap={false}>
            {actions}

            {typeof requestHeartbeatState === 'boolean' && (
              <Tooltip
                asChild
                content={requestHeartbeatState ? t('heartbeatTooltip.requested') : t('heartbeatTooltip.notRequested')}
              >
               <Button
                  size="xsmall"
                  color="tertiary"
                  preIcon={
                    <HeartbeatIcon
                      color={
                        requestHeartbeatState ? 'destructive' : 'lighter'
                      }
                      size="xsmall"
                    />
                  }
                  hideLabel
                  square
                />
              </Tooltip>
            )}
          </HStack>
        </HStack>
      </HStack>
      {open && (
        <VStack color="background-grey" border gap={false}>
          <VStack gap={false}>
            <VStack
              borderBottom
              paddingX="medium"
              paddingBottom="xsmall"
              paddingTop="medium"
            >
              <Typography variant="body3">{t('request')}</Typography>
            </VStack>
            <RawCodeEditor
              hideLabel
              color="background"
              variant="minimal"
              fullWidth
              showLineNumbers={false}
              fontSize="small"
              label=""
              language="javascript"
              code={inputs}
            />
          </VStack>
          {response && (
            <VStack borderTop gap={false}>
              <VStack
                paddingTop="xsmall"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
                <TabGroup
                  size="xsmall"
                  extendBorder
                  value={responseView}
                  onValueChange={(value) => {
                    if (!value) return;
                    setResponseView(value as ResponseViews);
                  }}
                  items={[
                    {
                      label: t('response'),
                      value: 'response',
                    },
                    {
                      label: 'stdout',
                      value: 'stdout',
                    },
                    {
                      label: 'stderr',
                      value: 'stderr',
                    },
                  ]}
                />
              </VStack>
              {responseData ? (
                <>
                  <RawCodeEditor
                    hideLabel
                    color="background"
                    variant="minimal"
                    fullWidth
                    label=""
                    language="javascript"
                    showLineNumbers={false}
                    fontSize="small"
                    code={partialResponseData || ''}
                  />
                  {responseData.length >= FUNCTION_CALL_LIMIT && (
                    <FunctionCallDataViewerDialog
                      trigger={
                        <Button
                          label={t('seeMore')}
                          color="tertiary"
                          fullWidth
                          preIcon={<ContextWindowIcon size="small" />}
                        />
                      }
                      content={responseData}
                    />
                  )}
                </>
              ) : (
                <HStack padding="small">
                  <Typography italic variant="body3">
                    {t('empty')}
                  </Typography>
                </HStack>
              )}
            </VStack>
          )}
        </VStack>
      )}
    </div>
  );
}
