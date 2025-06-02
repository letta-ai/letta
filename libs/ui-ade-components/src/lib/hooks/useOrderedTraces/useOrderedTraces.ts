import type { OtelTrace } from '@letta-cloud/types';
import { useMemo } from 'react';

export interface OrderedTrace {
  traceDetails: OtelTrace;
  children: OrderedTrace[];
}

function orderTraces(traces: OtelTrace[]): OrderedTrace[] {
  const spanMap: Record<string, OrderedTrace> = {};

  traces.forEach((trace) => {
    spanMap[trace.SpanId] = {
      traceDetails: trace,
      children: [],
    };
  });

  traces.forEach((trace) => {
    if (trace.ParentSpanId) {
      const parent = spanMap[trace.ParentSpanId];
      if (parent) {
        parent.children.push(spanMap[trace.SpanId]);
      }
    }
  });

  return Object.values(spanMap).filter(
    (span) => !span.traceDetails.ParentSpanId,
  );
}
export function useOrderedTraces(traces: OtelTrace[]) {
  return useMemo(() => {
    if (!traces?.length) {
      return [];
    }
    return orderTraces(traces);
  }, [traces]);
}
