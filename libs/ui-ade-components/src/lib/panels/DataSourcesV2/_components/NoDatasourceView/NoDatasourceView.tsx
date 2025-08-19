import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  FolderOpenIcon,
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
      <VStack
        data-testid="no-datasources"
        className="min-h-[200px]"
        align="center"
        justify="center"
        fullWidth
        fullHeight
        paddingBottom="xlarge"
        border="dashed"
      >
        <LoadingEmptyStatusComponent
          noMinHeight
          iconOverride={<FolderOpenIcon color="muted" size="xxlarge" />}
          emptyAction={
            <VStack align="center" gap="small">
              <AttachDataSourceModal
                trigger={
                  <Button
                    fullWidth
                    bold
                    data-testid="attach-data-source"
                    color="secondary"
                    preIcon={<LinkIcon />}
                    size="small"
                    label={t('attach')}
                  />
                }
              />
              <CreateDataSourceModal
                trigger={
                  <Button
                    data-testid="create-new-data-source"
                    size="small"
                    fullWidth
                    preIcon={<PlusIcon />}
                    color="tertiary"
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
