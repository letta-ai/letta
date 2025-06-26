import { ToolManagerProvider } from '@letta-cloud/ui-ade-components';
import { FullScreenDashboardPageLayout } from '@letta-cloud/ui-component-library';

interface ToolsPageLayoutProps {
  children: React.ReactNode;
}

export function ToolsPageLayout(props: ToolsPageLayoutProps) {
  const { children } = props;
  return (
    <ToolManagerProvider>
      <FullScreenDashboardPageLayout>{children}</FullScreenDashboardPageLayout>
    </ToolManagerProvider>
  );
}
