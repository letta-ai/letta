import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  FolderIcon,
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
        className="min-h-[300px]"
        align="center"
        justify="center"
        fullWidth
        fullHeight
        paddingBottom="xlarge"
        border="dashed"
      >
        <LoadingEmptyStatusComponent
          noMinHeight
          iconOverride={<FolderIcon size="xxlarge" />}
          emptyAction={
            <VStack align="center" gap="small">
              <AttachDataSourceModal
                trigger={
                  <Button
                    fullWidth
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
