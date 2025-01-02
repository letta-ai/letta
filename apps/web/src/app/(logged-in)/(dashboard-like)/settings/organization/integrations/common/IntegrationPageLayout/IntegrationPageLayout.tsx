import React from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  HStack,
  Typography,
  VStack,
} from '@letta-web/component-library';

interface IntegrationPageLayoutProps {
  image: React.ReactNode;
  description: string;
  website: string;
  actions?: React.ReactNode;
  configuration: React.ReactNode;
  usage: React.ReactNode;
  disconnect?: React.ReactNode;
}

function IntegrationPageLayout(props: IntegrationPageLayoutProps) {
  const {
    image,
    website,
    disconnect,
    configuration,
    usage,
    description,
    actions,
  } = props;
  const t = useTranslations('organization/integrations/IntegrationPageLayout');

  return (
    <DashboardPageLayout
      returnButton={{
        text: t('return'),
        href: '/settings/organization/integrations',
      }}
      icon={image}
      title=""
      actions={
        <HStack>
          {actions}
          <Button
            target="_blank"
            href={website}
            color="tertiary"
            label={t('visitWebsite')}
          />
        </HStack>
      }
    >
      <DashboardPageSection title={t('about')}>
        <Typography variant="body">{description}</Typography>
      </DashboardPageSection>
      <DashboardPageSection title={t('configuration')}>
        {configuration}
      </DashboardPageSection>
      <DashboardPageSection title={t('usage')}>{usage}</DashboardPageSection>
      {disconnect && (
        <DashboardPageSection
          title={t('disconnect.title')}
          description={t('disconnect.description')}
        >
          <VStack paddingTop="small">{disconnect}</VStack>
        </DashboardPageSection>
      )}
    </DashboardPageLayout>
  );
}

export default IntegrationPageLayout;
