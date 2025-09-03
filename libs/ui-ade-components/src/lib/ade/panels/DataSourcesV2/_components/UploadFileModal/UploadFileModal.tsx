import { useTranslations } from '@letta-cloud/translations';
import React, { useCallback } from 'react';
import type { Source } from '@letta-cloud/sdk-core';
import { Dialog, VStack } from '@letta-cloud/ui-component-library';
import { DataSourceFileUpload } from '../DataSourceView/DataSourceFileUpload/DataSourceFileUpload';

export interface UploadFileModalProps {
  source: Source;
  trigger: React.ReactNode;
}

export function UploadFileModal(props: UploadFileModalProps) {
  const { source, trigger } = props;
  const t = useTranslations('ADE/EditDataSourcesPanel.UploadFileModal');
  const [isOpen, setIsOpen] = React.useState(false);

  const handleOpenChange = useCallback((state: boolean) => {
    setIsOpen(state);
  }, []);

  const handleUploadComplete = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      title={t('title', { sourceName: source.name })}
      testId="upload-file-modal"
      trigger={trigger}
      hideFooter
      disableForm
    >
      <VStack paddingBottom>
        <DataSourceFileUpload
          sourceId={source.id || ''}
          onUploadComplete={handleUploadComplete}
        />
      </VStack>
    </Dialog>
  );
}
