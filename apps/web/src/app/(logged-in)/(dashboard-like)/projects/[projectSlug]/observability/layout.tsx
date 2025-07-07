import { ObservabilityProvider } from '$web/client/hooks/useObservabilityContext/useObservabilityContext';

interface ObservabilityLayoutProps {
  children: React.ReactNode;
}

export default function ObservabilityLayout(props: ObservabilityLayoutProps) {
  const { children } = props;

  return (
    <div className="w-full pr-1 encapsulated-full-height h-0 overflow-y-auto">
      <ObservabilityProvider>{children}</ObservabilityProvider>
    </div>
  );
}
