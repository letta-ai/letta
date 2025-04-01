import { useTranslations } from '@letta-cloud/translations';
import { Alert, ExternalLink, VStack } from '@letta-cloud/ui-component-library';

export function NoCloudAccessAPIPage() {
  const t = useTranslations('api-keys/page');

  return (
    <VStack padding>
      <Alert variant="warning" title={t('noCloudAccess.title')}>
        {t.rich('noCloudAccess.description', {
          link: (chunks) => (
            <ExternalLink href="https://docs.letta.com/guides/server/remote#securing-your-letta-server">
              {chunks}
            </ExternalLink>
          ),
        })}
      </Alert>
    </VStack>
  );
}
