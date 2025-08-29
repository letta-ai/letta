'use client';
import React from 'react';
import { DataSourceDetailTable } from '@letta-cloud/ui-ade-components';
import { useCurrentDataSourceId } from './hooks';
import { useUserHasPermission } from '$web/client/hooks';
import { ApplicationServices } from '@letta-cloud/service-rbac';

function DataSourceFilesPage() {
  const sourceId = useCurrentDataSourceId();

  const [canUpload] = useUserHasPermission(
    ApplicationServices.UPDATE_DATA_SOURCE,
  );
  const [canUpdate] = useUserHasPermission(
    ApplicationServices.UPDATE_DATA_SOURCE,
  );
  const [canDelete] = useUserHasPermission(
    ApplicationServices.DELETE_DATA_SOURCE,
  );

  return (
    <DataSourceDetailTable
      dataSourceId={sourceId}
      isDesktop={false}
      canUpload={canUpload}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  );
}

export default DataSourceFilesPage;
