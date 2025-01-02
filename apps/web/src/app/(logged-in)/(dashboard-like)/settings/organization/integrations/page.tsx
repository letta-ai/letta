'use client';
import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  Card,
  ComposioLogoMark,
  DashboardPageLayout,
  DashboardPageSection,
  HStack,
  Typography,
  VStack,
} from '@letta-web/component-library';
import { Slot } from '@radix-ui/react-slot';

interface IntegrationItemProps {
  name: string;
  href: string;
  description: string;
  image: React.ReactNode;
}

function IntegrationItem(props: IntegrationItemProps) {
  const { href, description, name, image } = props;
  const t = useTranslations('organization/integrations');

  return (
    <Card>
      <HStack align="center" padding="xxsmall" gap="medium">
        <HStack gap="large" align="center" justify="start">
          <Slot
            /* eslint-disable-next-line react/forbid-component-props */
            className="h-[48px] w-[48px]"
          >
            {image}
          </Slot>
          <VStack gap={false}>
            <Typography align="left" variant="body" bold>
              {name}
            </Typography>
            <Typography align="left" color="lighter" variant="body">
              {description}
            </Typography>
          </VStack>
        </HStack>
        <Button
          color="tertiary"
          href={href}
          label={t('IntegrationItem.configure')}
        ></Button>
      </HStack>
    </Card>
  );
}

function IntegrationsSettingsPage() {
  const t = useTranslations('organization/integrations');

  return (
    <DashboardPageLayout title={t('title')} subtitle={t('description')}>
      <DashboardPageSection>
        <IntegrationItem
          image={<ComposioLogoMark />}
          href="/settings/organization/integrations/composio"
          name={t('integrations.composio.title')}
          description={t('integrations.composio.description')}
        />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default IntegrationsSettingsPage;
