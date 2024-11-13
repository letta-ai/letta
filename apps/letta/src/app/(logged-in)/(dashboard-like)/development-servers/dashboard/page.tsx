'use client';
import {
  ActionCard,
  DashboardPageLayout,
  DashboardPageSection,
  NiceGridDisplay,
  RobotIcon,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import { Tutorials } from '$letta/client/components';
import { CreateLocalAgentDialog } from '../shared/CreateLocalAgentDialog/CreateLocalAgentDialog';

function DevelopmentServersDashboardPage() {
  const t = useTranslations('development-servers/dashboard/page');

  return (
    <DashboardPageLayout title={t('title')}>
      <DashboardPageSection title={t('gettingStarted.title')}>
        <NiceGridDisplay>
          <CreateLocalAgentDialog
            trigger={
              <ActionCard
                icon={<RobotIcon />}
                title={t('gettingStarted.actions.createAgent.title')}
                description={t(
                  'gettingStarted.actions.createAgent.description'
                )}
              />
            }
          />
        </NiceGridDisplay>
      </DashboardPageSection>
      <Tutorials />
    </DashboardPageLayout>
  );
}

export default DevelopmentServersDashboardPage;
