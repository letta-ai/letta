'use client';
import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import {
  CheckCircleFilledIcon,
  ChevronDownIcon,
  ChevronRightIcon,
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

interface FunctionCallProps {
  name: string;
  inputs: string;
  response?: ToolReturnMessageSchemaType;
  status?: string;
  id: string;
}

type ResponseViews = 'response' | 'stderr' | 'stdout';

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

  const statusMessage = useMemo(() => {
    if (!response?.tool_return) {
      return t('isExecuting');
    }

    if (status === 'success') {
      return t('success');
    }

    return t('error');
  }, [response?.tool_return, status, t]);

  const statusColor = useMemo(() => {
    if (!response?.tool_return) {
      return 'warning';
    }

    if (status === 'success') {
      return 'success';
    }

    return 'destructive';
  }, [response?.tool_return, status]);

  const statusIcon = useMemo(() => {
    if (!response?.tool_return) {
      return <Spinner size="small" />;
    }

    if (status === 'success') {
      return <CheckCircleFilledIcon size="small" />;
    }

    return <WarningIcon />;
  }, [response?.tool_return, status]);

  const [responseView, setResponseView] = useState<ResponseViews>('response');

  const responseData = useMemo(() => {
    switch (responseView) {
      case 'response':
        return response?.tool_return;
      case 'stdout':
        return response?.stdout?.join('\n');
      case 'stderr':
        return response?.stderr?.join('\n');

      default:
        return null;
    }
  }, [response, responseView]);

  return (
    <details
      className="w-full"
      open={open}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          toggleOpen();
        }
      }}
    >
      <HStack gap={false} as="summary">
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
              preIcon={statusIcon}
              content={statusMessage}
              variant={statusColor}
            />
          </HStack>
        </HStack>
      </HStack>
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
              <RawCodeEditor
                hideLabel
                color="background"
                variant="minimal"
                fullWidth
                label=""
                language="javascript"
                showLineNumbers={false}
                fontSize="small"
                code={responseData}
              />
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
    </details>
  );
}
