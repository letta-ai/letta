import { VStack } from '@letta-cloud/ui-component-library';
import { ObservabilityHeader } from '../ObservabilityHeader/ObservabilityHeader';

interface ObservabilityPageWrapperProps {
  children: React.ReactNode;
  title?: string;
}

export function ObservabilityPageWrapper(props: ObservabilityPageWrapperProps) {
  const { children, title } = props;

  return (
    <div className="w-full pr-1 encapsulated-full-height h-full">
      <VStack color="background" fullWidth fullHeight gap={false}>
        <ObservabilityHeader subPage={title ? { title } : undefined} />
        <VStack overflowY="auto" gap={false} fullHeight fullWidth>
          {children}
        </VStack>
      </VStack>
    </div>
  );
}
