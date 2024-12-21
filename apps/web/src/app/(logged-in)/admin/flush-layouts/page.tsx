'use client';
import { Button } from '@letta-web/component-library';
import { useCallback } from 'react';
import { webApi } from '$web/client';

function FlushLayoutsPage() {
  const { mutate, isPending } =
    webApi.admin.flushLayouts.flushLayouts.useMutation();

  const handleFlushLayouts = useCallback(() => {
    if (confirm('Are you sure you want to flush all layouts?')) {
      mutate({});
    }
  }, [mutate]);

  return (
    <Button
      busy={isPending}
      label="Flush Layouts"
      onClick={handleFlushLayouts}
    />
  );
}

export default FlushLayoutsPage;
