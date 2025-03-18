import { VStack } from '@letta-cloud/ui-component-library';
import { ToolManagerHeader } from '../ToolManagerHeader/ToolManagerHeader';
import type { BreadcrumbItemType } from '@letta-cloud/ui-component-library';

interface ToolManagerPageProps {
  children: React.ReactNode;
  border?: boolean;
  breadcrumbs?: BreadcrumbItemType[];
}

export function ToolManagerPage(props: ToolManagerPageProps) {
  const { children, border, breadcrumbs } = props;
  return (
    <VStack gap={false} fullWidth fullHeight overflow="hidden">
      <ToolManagerHeader breadcrumbs={breadcrumbs} />
      <VStack borderTop={border} overflow="hidden" collapseHeight flex>
        {children}
      </VStack>
    </VStack>
  );
}
