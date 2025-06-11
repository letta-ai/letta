import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import {
  Breadcrumb,
  LoadingEmptyStatusComponent,
  MessageReplay,
  Section,
  SideOverlay,
  SideOverlayHeader,
  VStack,
} from '@letta-cloud/ui-component-library';
import React, { useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import type { OtelTrace } from '@letta-cloud/types';

interface ViewMessageTraceProps {
  traceId: string;
  trigger?: React.ReactNode;
}

interface TraceDetailsProps {
  traces: OtelTrace[];
}

function TraceDetails(props: TraceDetailsProps) {
  const { traces } = props;

  const t = useTranslations('pages/projects/observability/TraceDetails');

  return (
    <VStack overflowY="auto" padding fullWidth fullHeight>
      <Section fullHeight title={t('title')} description={t('description')}>
        <MessageReplay traces={traces} />
      </Section>
    </VStack>
  );
}

export function ViewMessageTrace(props: ViewMessageTraceProps) {
  const { traceId, trigger } = props;
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

  const t = useTranslations('pages/projects/observability/ViewMessageTrace');

  return (
    <SideOverlay
      isOpen={open}
      trigger={trigger}
      onOpenChange={setOpen}
      title={t('title')}
    >
      <VStack fullHeight fullWidth gap={false}>
        <SideOverlayHeader>
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
        </SideOverlayHeader>
        <VStack fullHeight collapseHeight flex>
          {!traceData ? (
            <LoadingEmptyStatusComponent
              emptyMessage=""
              loadingMessage={t('loadingMessage')}
              isLoading
            />
          ) : (
            <TraceDetails traces={traceData.body} />
          )}
        </VStack>
      </VStack>
    </SideOverlay>
  );
}
