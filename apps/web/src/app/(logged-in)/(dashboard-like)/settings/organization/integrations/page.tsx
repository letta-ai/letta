'use client';
import { useTranslations } from 'next-intl';
import {
  Button,
  Card,
  ComposioLockup,
  DashboardPageLayout,
  DashboardPageSection,
  HStack,
  Typography,
  VStack,
} from '@letta-web/component-library';

interface IntegrationItemProps {
  name: string;
  href: string;
  description: string;
  image: React.ReactNode;
}

function IntegrationItem(props: IntegrationItemProps) {
  const { href, description, image } = props;
  const t = useTranslations('organization/integrations');

  return (
    <Card>
      <VStack padding="xxsmall" gap="medium">
        <HStack align="center" justify="spaceBetween">
          {image}
          <Button
            color="tertiary"
            href={href}
            label={t('IntegrationItem.configure')}
          ></Button>
        </HStack>
        <Typography variant="body">{description}</Typography>
      </VStack>
    </Card>
  );
}

function IntegrationsSettingsPage() {
  const t = useTranslations('organization/integrations');

  return (
    <DashboardPageLayout title={t('title')} subtitle={t('description')}>
      <DashboardPageSection>
        <IntegrationItem
          image={<ComposioLockup height={30} />}
          href="/settings/organization/integrations/composio"
          name={t('integrations.composio.title')}
          description={t('integrations.composio.description')}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default IntegrationsSettingsPage;
