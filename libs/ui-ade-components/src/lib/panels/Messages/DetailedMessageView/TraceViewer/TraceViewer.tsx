import type { OtelTrace } from '@letta-cloud/types';
import { RawCodeEditor, VStack } from '@letta-cloud/ui-component-library';

interface TraceViewerProps {
  traces: OtelTrace[];
}

export function TraceViewer(props: TraceViewerProps) {
  const { traces } = props;

  return (
    <VStack collapseHeight paddingBottom flex>
      <VStack collapseHeight border overflowY="auto">
        <RawCodeEditor
          label=""
          fullWidth
          variant="minimal"
          fontSize="small"
          hideLabel
          showLineNumbers={false}
          language="javascript"
          code={JSON.stringify(traces, null, 2)}
        />
      </VStack>
    </VStack>
  );
}
