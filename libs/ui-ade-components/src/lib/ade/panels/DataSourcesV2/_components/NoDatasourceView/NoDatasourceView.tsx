import { useTranslations } from '@letta-cloud/translations';
import {
  Alert,
  Button,
  FileIcon,
  FolderOpenIcon,
  LinkIcon,
  LoadingEmptyStatusComponent,
  PanelMainContent,
  PlusIcon,
  Typography,
  useDragAndDrop,
  VStack,
} from '@letta-cloud/ui-component-library';
import {
  type AgentState,
  type SourcesServiceListSourcesDefaultResponse,
  useAgentsServiceAttachSourceToAgent,
  UseAgentsServiceRetrieveAgentKeyFn,
  useSourcesServiceCreateSource,
  UseSourcesServiceListSourcesKeyFn,
  useSourcesServiceUploadFileToSource,
} from '@letta-cloud/sdk-core';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { CreateDataSourceModal } from '../CreateDataSourceModal/CreateDataSourceModal';
import { AttachDataSourceModal } from '../AttachDataSourceModal';
import { useCurrentAgent } from '../../../../../hooks';

export function NoDatasourceView() {
  const t = useTranslations('ADE/DataSourcesPanel/NoDatasourceView');
  const dropZoneRef = useRef<HTMLElement>(null);
  const queryClient = useQueryClient();
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { id: agentId } = useCurrentAgent();

  const { mutate: createDataSource } = useSourcesServiceCreateSource();
  const { mutate: attachDataSource } = useAgentsServiceAttachSourceToAgent();
  const { mutate: uploadFileToSource } = useSourcesServiceUploadFileToSource();

  const generateFolderName = useCallback((files: FileList) => {
    if (files.length === 0) return 'uploaded-files';
    const fileName = files[0].name.split('.')[0] || 'uploaded-file';
    return `${fileName}-${Date.now()}`;
  }, []);

  const handleFilesUpload = useCallback(
    (files: FileList, sourceId: string) => {
      Array.from(files).forEach((file) => {
        uploadFileToSource({
          sourceId,
          formData: { file },
          duplicateHandling: 'suffix',
        });
      });
    },
    [uploadFileToSource],
  );

  const handleFilesSelected = useCallback(
    (files: FileList) => {
      if (files.length === 0) return;

      setIsCreatingFolder(true);
      setError(null);
      const folderName = generateFolderName(files);

      createDataSource(
        {
          requestBody: {
            name: folderName,
          },
        },
        {
          onSuccess: (response) => {
            attachDataSource(
              {
                agentId,
                sourceId: response.id || '',
              },
              {
                onSuccess: () => {
                  queryClient.setQueriesData<
                    SourcesServiceListSourcesDefaultResponse | undefined
                  >(
                    {
                      queryKey: UseSourcesServiceListSourcesKeyFn(),
                    },
                    (oldData) => {
                      if (!oldData) {
                        return [response];
                      }
                      return [
                        response,
                        ...oldData.filter(
                          (currentSource) => currentSource.id !== response.id,
                        ),
                      ];
                    },
                  );

                  queryClient.setQueriesData<AgentState | undefined>(
                    {
                      queryKey: UseAgentsServiceRetrieveAgentKeyFn({
                        agentId,
                      }),
                    },
                    (oldData) => {
                      if (!oldData) {
                        return oldData;
                      }
                      return {
                        ...oldData,
                        sources: [
                          response,
                          ...oldData.sources.filter(
                            (currentSource) => currentSource.id !== response.id,
                          ),
                        ],
                      };
                    },
                  );

                  handleFilesUpload(files, response.id || '');
                  setIsCreatingFolder(false);
                },
                onError: () => {
                  setIsCreatingFolder(false);
                  setError(t('errors.attachFolderError'));
                },
              },
            );
          },
          onError: () => {
            setIsCreatingFolder(false);
            setError(t('errors.createFolderError'));
          },
        },
      );
    },
    [
      agentId,
      attachDataSource,
      createDataSource,
      generateFolderName,
      handleFilesUpload,
      queryClient,
      t,
    ],
  );

  const {
    isDragging,
    handleDragEnter: originalHandleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  } = useDragAndDrop({
    onFilesSelected: handleFilesSelected,
    acceptMultiple: true,
    dropZoneRef,
  });

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      setError(null);
      originalHandleDragEnter(e);
    },
    [originalHandleDragEnter],
  );

  if (isCreatingFolder) {
    return (
      <PanelMainContent>
        <VStack
          className="min-h-[200px]"
          align="center"
          justify="center"
          fullWidth
          fullHeight
          paddingBottom="xlarge"
        >
          <LoadingEmptyStatusComponent
            isLoading={true}
            loaderVariant="grower"
            emptyMessage={t('loading.creatingFolder')}
          />
        </VStack>
      </PanelMainContent>
    );
  }

  return (
    <PanelMainContent>
      <VStack
        ref={dropZoneRef}
        className="min-h-[200px] relative"
        data-testid="no-datasources"
        align="center"
        justify="center"
        fullWidth
        fullHeight
        paddingBottom="xlarge"
        border="dashed"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center transition-all"
            style={{
              border: '2px dotted hsl(var(--border-drag))',
              backgroundColor: 'hsl(var(--background-grey))',
            }}
          >
            <VStack align="center" gap="medium">
              <FileIcon size="xxlarge" color="brand" />
              <Typography variant="body" align="center" bold>
                {t('dragAndDrop.dropMessage')}
              </Typography>
              <Typography variant="body2" align="center" color="muted">
                {t('dragAndDrop.autoCreateMessage')}
              </Typography>
            </VStack>
          </div>
        )}

        <VStack align="center" gap="medium" fullWidth>
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
          {error && (
            <Alert
              variant="destructive"
              title={t('errors.uploadErrorTitle')}
              onDismiss={() => {
                setError(null);
              }}
            >
              {error}
            </Alert>
          )}
        </VStack>
      </VStack>
    </PanelMainContent>
  );
}
