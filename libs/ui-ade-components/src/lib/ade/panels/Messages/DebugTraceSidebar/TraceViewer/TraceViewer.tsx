'use client';
import type { OtelTrace } from '@letta-cloud/types';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  Code,
  HStack,
  SearchIcon,
  Tooltip,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useMemo, useState } from 'react';
import { useFormatters } from '@letta-cloud/utils-client';
import { useTranslations } from '@letta-cloud/translations';
import type { OrderedTrace } from '../../../../../hooks';
import { useOrderedTraces } from '../../../../../hooks';

interface TraceViewerProps {
  traces: OtelTrace[];
}

interface RenderSpanAttributesProps {
  trace: OrderedTrace;
}

function RenderSpanAttributes(props: RenderSpanAttributesProps) {
  const { trace } = props;

  const {
    SpanAttributes,
    ['Events.Attributes']: eventAttributes,
    ['Events.Name']: eventNames,
  } = trace.traceDetails || {};

  const mappedEvents = useMemo(() => {
    if (!eventAttributes || !eventNames) return [];
    return eventAttributes.reduce(
      (acc, attribute, index) => {
        const eventName = eventNames[index];
        if (eventName) {
          acc[eventName] = attribute;
        }
        return acc;
      },
      {} as Record<string, any>,
    );
  }, [eventAttributes, eventNames]);

  const attributes = useMemo(() => {
    if (SpanAttributes) {
      return { ...SpanAttributes, ...mappedEvents };
    }
    return mappedEvents;
  }, [SpanAttributes, mappedEvents]);

  const t = useTranslations('ADE/AgentSimulator/TraceViewer');
  const stringifiedAttributeArray = useMemo(() => {
    return Object.entries(attributes).map(([key, value]) => ({
      key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
    }));
  }, [attributes]);

  return (
    <HStack overflow="auto" fullWidth>
      <table className="border w-full">
        <thead>
          <tr className="bg-background-grey2 border-b">
            <th className="px-2 text-left border-r">
              <Typography variant="body4">{t('table.key')}</Typography>
            </th>
            <th className="px-2 text-left w-full">
              <Typography variant="body4">{t('table.value')}</Typography>
            </th>
          </tr>
        </thead>
        <tbody>
          {stringifiedAttributeArray.map((attribute) => (
            <tr key={attribute.key}>
              <td className="px-2">
                <Typography variant="body3" color="lighter">
                  {attribute.key}
                </Typography>
              </td>
              <td>
                <Code
                  variant="minimal"
                  code={attribute.value}
                  showLineNumbers={false}
                  fontSize="small"
                  language="javascript"
                  color="transparent"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </HStack>
  );
}

interface TraceDetailsProps {
  trace: OrderedTrace;
}

function TraceDetails({ trace }: TraceDetailsProps) {
  const { formatSmallDuration } = useFormatters();
  const [showChildren, setShowChildren] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  const t = useTranslations('ADE/AgentSimulator/TraceViewer');

  return (
    <VStack gap={false} fullWidth>
      <VStack
        fullWidth
        gap="medium"
        paddingX="xsmall"
        color={showRaw ? 'background-grey' : 'transparent'}
        paddingY="xsmall"
      >
        <HStack align="center" fullWidth justify="spaceBetween">
          <HStack align="center" gap="small">
            {trace.children.length > 0 && (
              <Tooltip
                asChild
                content={showChildren ? t('children.hide') : t('children.view')}
              >
                <button
                  onClick={() => {
                    setShowChildren((prev) => !prev);
                  }}
                >
                  {showChildren ? (
                    <ChevronDownIcon size="xsmall" />
                  ) : (
                    <ChevronRightIcon size="xsmall" />
                  )}
                </button>
              </Tooltip>
            )}
            {trace.traceDetails.SpanAttributes && (
              <Tooltip
                asChild
                content={showRaw ? t('raw.hide') : t('raw.view')}
              >
                <button
                  onClick={() => {
                    setShowRaw((prev) => !prev);
                  }}
                  className="flex gap-1"
                >
                  <SearchIcon size="xsmall" />
                  <Typography variant="body3">
                    {trace.traceDetails.SpanName}
                  </Typography>
                </button>
              </Tooltip>
            )}
          </HStack>
          <HStack>
            <Typography variant="body4">
              {formatSmallDuration(trace.traceDetails.Duration)}
            </Typography>
          </HStack>
        </HStack>
        {showRaw && <RenderSpanAttributes trace={trace} />}
      </VStack>
      {trace.children.length > 0 && (
        <>
          {showChildren && (
            <VStack gap={false} paddingLeft="large">
              {trace.children.map((child) => (
                <TraceDetails key={child.traceDetails.SpanId} trace={child} />
              ))}
            </VStack>
          )}
        </>
      )}
    </VStack>
  );
}

export function TraceViewer(props: TraceViewerProps) {
  const { traces } = props;

  const orderedTraces = useOrderedTraces(traces);

  return (
    <VStack>
      {orderedTraces.map((trace) => (
        <TraceDetails key={trace.traceDetails.SpanId} trace={trace} />
      ))}
    </VStack>
  );
}
