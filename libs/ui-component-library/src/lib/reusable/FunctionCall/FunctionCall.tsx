'use client';
import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import {
  CheckCircleFilledIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ContextWindowIcon,
  FunctionIcon,
  WarningIcon,
} from '../../icons';
import { Typography } from '../../core/Typography/Typography';
import { RawCodeEditor } from '../../core/Code/Code';
import { useTranslations } from '@letta-cloud/translations';
import { Spinner } from '../../core/Spinner/Spinner';
import { useCallback, useMemo, useState } from 'react';
import { useAtom } from 'jotai';
import { Badge } from '../../core/Badge/Badge';
import type { ToolReturnMessageSchemaType } from '@letta-cloud/sdk-core';
import { TabGroup } from '../../core/TabGroup/TabGroup';
import { functionCallOpenStatusAtom } from './functionCallOpenStatusAtom';
import { Dialog } from '../../core/Dialog/Dialog';
import { VirtualizedCodeViewer } from '../../core/VirtualizedCodeViewer/VirtualizedCodeViewer';
import { Button } from '../../core/Button/Button';
import { useCopyToClipboard } from '../../hooks';

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

interface FunctionCallProps {
  name: string;
  inputs: string;
  response?: ToolReturnMessageSchemaType;
  status?: string;
  id: string;
}

type ResponseViews = 'response' | 'stderr' | 'stdout';

const FUNCTION_CALL_LIMIT = 10_000;

export function FunctionCall(props: FunctionCallProps) {
  const { id, name, inputs, response, status } = props;
  const [openStates, setOpenStates] = useAtom(functionCallOpenStatusAtom);

  const open = useMemo(() => {
    return openStates?.[id] || false;
  }, [id, openStates]);

  const toggleOpen = useCallback(() => {
    setOpenStates((prev) => ({ ...prev, [id]: !open }));
  }, [id, open, setOpenStates]);

  const t = useTranslations('ui-component-library/FunctionCall');

  const statusInfo = useMemo(() => {
    if (status === 'success') {
      return {
        message: t('success'),
        color: 'success' as const,
        icon: <CheckCircleFilledIcon size="small" />,
      };
    }

    if (!response?.tool_return && status !== 'error') {
      return {
        message: t('isExecuting'),
        color: 'warning' as const,
        icon: <Spinner size="small" />,
      };
    }

    return {
      message: t('error'),
      color: 'destructive' as const,
      icon: <WarningIcon />,
    }

  }, [response?.tool_return, status, t]);

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
      <HStack onClick={toggleOpen} gap={false}>
        <HStack align="center" className="h-[24px]" gap="medium">
          <HStack
            gap="large"
            align="center"
            className="px-2 pr-3 py-1 bg-background-grey3 text-background-grey3-content cursor-pointer"
          >
            <HStack gap="small">
              {!open ? (
                <ChevronRightIcon size="small" />
              ) : (
                <ChevronDownIcon size="small" />
              )}
              <FunctionIcon size="small" />
              <Typography bold variant="body3">
                {name}
              </Typography>
            </HStack>
            <Badge
              preIcon={statusInfo.icon}
              content={statusInfo.message}
              variant={statusInfo.color}
            />
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
