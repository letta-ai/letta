import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  DatabaseIcon,
  LinkIcon,
  LoadingEmptyStatusComponent,
  PanelMainContent,
  PlusIcon,
  VStack,
} from '@letta-cloud/ui-component-library';
import { CreateDataSourceModal } from '../CreateDataSourceModal/CreateDataSourceModal';
import { AttachDataSourceModal } from '../AttachDataSourceModal';

export function NoDatasourceView() {
  const t = useTranslations('ADE/DataSourcesPanel/NoDatasourceView');

  return (
    <PanelMainContent>
      <VStack fullWidth fullHeight paddingBottom="xlarge" border="dashed">
        <LoadingEmptyStatusComponent
          noMinHeight
          iconOverride={<DatabaseIcon size="xxlarge" />}
          emptyAction={
            <VStack align="center" gap="small">
              <AttachDataSourceModal
                trigger={
                  <Button
                    fullWidth
                    color="primary"
                    preIcon={<LinkIcon />}
                    size="small"
                    label={t('attach')}
                  />
                }
              />
              <CreateDataSourceModal
                trigger={
                  <Button
                    size="small"
                    fullWidth
                    color="tertiary"
                    preIcon={<PlusIcon />}
                    label={t('new')}
                  />
                }
              />
            </VStack>
          }
          emptyMessage={t('title')}
        />
      </VStack>
    </PanelMainContent>
  );
}
