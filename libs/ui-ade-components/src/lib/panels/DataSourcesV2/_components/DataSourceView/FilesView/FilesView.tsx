import { useSourcesServiceListSourceFiles } from '@letta-cloud/sdk-core';
import {
  Alert,
  LoadingEmptyStatusComponent,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { DataSourceFileUpload } from '../DataSourceFileUpload/DataSourceFileUpload';
import { FileView } from './FileView/FileView';
import { DEFAULT_FILE_LIMIT } from '../../../constants';

interface FilesViewProps {
  sourceId: string;
}

export function FilesView(props: FilesViewProps) {
  const { sourceId } = props;

  const t = useTranslations('ADE/DataSources/FilesView');

  const { data: files, isError } = useSourcesServiceListSourceFiles(
    {
      sourceId,
      limit: DEFAULT_FILE_LIMIT,
    },
    undefined,
  );

  if (!files) {
    return <LoadingEmptyStatusComponent noMinHeight loaderVariant="grower" />;
  }

  if (isError) {
    return <Alert title={t('error')} variant="destructive" />;
  }

  if (files.length === 0) {
    return (
      <VStack fullHeight>
        <DataSourceFileUpload sourceId={sourceId} />
      </VStack>
    );
  }

  return (
    <VStack>
      {files.map((file) => (
        <FileView key={file.id || ''} file={file} />
      ))}
    </VStack>
  );
}
