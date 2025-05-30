import { ObservabilityProvider } from './_components/hooks/useObservabilityContext/useObservabilityContext';

interface ObservabilityLayoutProps {
  children: React.ReactNode;
}

export default function ObservabilityLayout(props: ObservabilityLayoutProps) {
  const { children } = props;

  return <ObservabilityProvider>{children}</ObservabilityProvider>;
}
