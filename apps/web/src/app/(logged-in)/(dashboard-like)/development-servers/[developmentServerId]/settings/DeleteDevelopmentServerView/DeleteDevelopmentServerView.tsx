import { useTranslations } from '@letta-cloud/translations';
import React from 'react';
import {
  Button,
  Section,
  Typography,
  HStack,
} from '@letta-cloud/ui-component-library';
import { DeleteDevelopmentServerDialog } from '../../../shared/DeleteDevelopmentServerDialog';

interface DeleteDevelopmentServerViewProps {
  developmentServerId: string;
  developmentServerName: string;
}

export function DeleteDevelopmentServerView(
  props: DeleteDevelopmentServerViewProps,
) {
  const { developmentServerId, developmentServerName } = props;
  const t = useTranslations('development-servers/page');

  return (
    <Section title={t('DeleteDevelopmentServerSection.title')}>
      <Typography>{t('DeleteDevelopmentServerSection.description')}</Typography>

      <HStack>
        <DeleteDevelopmentServerDialog
          developmentServerId={developmentServerId}
          developmentServerName={developmentServerName}
          trigger={
            <Button
              color="destructive"
              label={t('DeleteDevelopmentServerSection.trigger')}
            ></Button>
          }
        />
      </HStack>
    </Section>
  );
}
