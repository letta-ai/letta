import {
  DashboardPageLayout,
  DashboardPageSection,
} from '@letta-web/component-library';
import { DashboardHeader } from '$letta/client/common';

function AdminHomepage() {
  return (
    <DashboardPageLayout header={<DashboardHeader title="Admin homepage" />}>
      <DashboardPageSection>Nothing here yet.</DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default AdminHomepage;
