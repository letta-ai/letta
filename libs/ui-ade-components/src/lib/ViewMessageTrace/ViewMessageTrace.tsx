'use client';
import { useFeatureFlag, webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import {
  Breadcrumb,
  LoadingEmptyStatusComponent,
  MessageReplay,
  Section,
  SideOverlay,
  SideOverlayHeader,
  HStack,
  VStack,
  Typography,
  Button,
} from '@letta-cloud/ui-component-library';
import React, { useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import type { OtelTrace } from '@letta-cloud/types';
import { useParams } from 'next/navigation';
import { TraceViewer } from '../ade/panels/Messages/DebugTraceSidebar/TraceViewer/TraceViewer';

interface ViewMessageTraceProps {
  traceId: string;
  trigger?: React.ReactNode;
  agentId: string;
  showAgentMetadata?: boolean;
}

interface TraceDetailsProps {
  traces: OtelTrace[];
  traceId: string;
  agentId: string;
  showAgentMetadata?: boolean;
}

function TraceDetails(props: TraceDetailsProps) {
  const { traces, agentId, showAgentMetadata } = props;
  const { projectSlug } = useParams();

  const t = useTranslations('ViewMessageTrace');

  return (
    <VStack gap="large" overflowY="auto" padding fullWidth fullHeight>
      {showAgentMetadata && (
        <HStack align="center" justify="spaceBetween" fullWidth>
          <VStack fullWidth>
            <HStack
              align="center"
              justify="spaceBetween"
              fullWidth
              paddingRight="small"
            >
              <Typography bold variant="large">
                {t('AgentMetadata')}
              </Typography>
              <Button
                href={`/projects/${projectSlug}/agents/${agentId}`}
                label={t('viewAgent')}
                color="secondary"
                size="small"
              />
            </HStack>
            <Typography variant="body2">{t('AgentId', { agentId })}</Typography>
          </VStack>
        </HStack>
      )}

      <VStack fullHeight>
        <Section fullHeight title={t('title')} description={t('description')}>
          <MessageReplay traces={traces} />
        </Section>
      </VStack>
    </VStack>
  );
}

export function ViewMessageTrace(props: ViewMessageTraceProps) {
  const { traceId, trigger, agentId, showAgentMetadata = true } = props;
  const [open, setOpen] = useState(false);
  const { data: traceData } = webApi.traces.getTrace.useQuery({
    queryKey: webApiQueryKeys.traces.getTrace(traceId || ''),
    queryData: {
      params: {
        traceId: traceId || '',
      },
    },
    enabled: !!traceId && open,
  });

  const { data: isAdvancedDebugView } = useFeatureFlag(
    'ADVANCED_MESSAGE_DEBUG',
  );

  const [rawMode, setRawMode] = useState(false);

  const t = useTranslations('ViewMessageTrace');

  return (
    <SideOverlay
      isOpen={open}
      trigger={trigger}
      onOpenChange={setOpen}
      title={t('title')}
    >
      <VStack fullHeight fullWidth gap={false}>
        <SideOverlayHeader>
          <HStack fullWidth justify="spaceBetween" align="center">
            <Breadcrumb
              size="small"
              items={[
                {
                  label: t('title'),
                  onClick: () => {
                    setOpen(false);
                  },
                },
                {
                  label: traceId,
                },
              ]}
            />
            {isAdvancedDebugView && (
              <Button
                label={t('raw')}
                size="xsmall"
                active={rawMode}
                color="tertiary"
                onClick={() => {
                  setRawMode((prev) => !prev);
                }}
              />
            )}
          </HStack>
        </SideOverlayHeader>
        <VStack fullHeight collapseHeight flex>
          {!traceData ? (
            <LoadingEmptyStatusComponent
              emptyMessage=""
              loadingMessage={t('loadingMessage')}
              isLoading
            />
          ) : (
            <>
              {rawMode ? (
                <VStack fullWidth fullHeight overflowY="auto">
                  <TraceViewer traces={traceData.body} />
                </VStack>
              ) : (
                <TraceDetails
                  showAgentMetadata={showAgentMetadata}
                  traces={traceData.body}
                  traceId={traceId}
                  agentId={agentId}
                />
              )}
            </>
          )}
        </VStack>
      </VStack>
    </SideOverlay>
  );
}
