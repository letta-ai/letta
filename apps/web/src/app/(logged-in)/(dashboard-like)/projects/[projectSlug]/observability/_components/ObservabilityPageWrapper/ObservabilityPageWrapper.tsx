import { VStack } from '@letta-cloud/ui-component-library';
import { ObservabilityHeader } from '../ObservabilityHeader/ObservabilityHeader';

interface ObservabilityPageWrapperProps {
  children: React.ReactNode;
  title?: string;
}

export function ObservabilityPageWrapper(props: ObservabilityPageWrapperProps) {
  const { children, title } = props;

  return (
    <VStack color="background" fullWidth fullHeight gap={false}>
      <ObservabilityHeader subPage={title ? { title } : undefined} />
      <VStack collapseHeight overflowY="auto" gap={false} fullHeight fullWidth>
        {children}
      </VStack>
    </VStack>
  );
}
