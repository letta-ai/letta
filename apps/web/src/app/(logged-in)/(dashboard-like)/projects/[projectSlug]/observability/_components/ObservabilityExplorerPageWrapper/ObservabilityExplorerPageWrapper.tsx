import { Alert, HR } from '@letta-cloud/ui-component-library';
import { ObservabilityTableWrapper } from '../ObservabilityTableWrapper/ObservabilityTableWrapper';
import { ObservabilityPageWrapper } from '../ObservabilityPageWrapper/ObservabilityPageWrapper';

interface ObservabilityExplorerPageWrapperProps {
  chart: React.ReactNode;
  pageTitle: string;
  table: React.ReactNode;
  tableTitle: string;
  info?: React.ReactNode;
}

export function ObservabilityExplorerPageWrapper(
  props: ObservabilityExplorerPageWrapperProps,
) {
  const { chart, pageTitle, tableTitle, table, info } = props;

  return (
    <ObservabilityPageWrapper title={pageTitle}>
      {chart}
      {info ? <Alert title={info} variant="info" /> : <HR />}
      <ObservabilityTableWrapper title={tableTitle}>
        {table}
      </ObservabilityTableWrapper>
    </ObservabilityPageWrapper>
  );
}
