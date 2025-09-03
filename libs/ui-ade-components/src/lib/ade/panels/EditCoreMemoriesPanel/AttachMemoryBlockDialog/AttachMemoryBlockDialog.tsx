import { Dialog, VStack } from '@letta-cloud/ui-component-library';
import { useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { SearchMemoryBlocks } from '../../../../SearchMemoryBlocks/SearchMemoryBlocks';
import { useADEAppContext } from '../../../../AppContext/AppContext';
import { useFeatureFlag } from '@letta-cloud/sdk-web';
import { useADEState } from '../../../../hooks/useADEState/useADEState';

interface AttachMemoryBlockDialogProps {
  trigger: React.ReactNode;
}

export function AttachMemoryBlockDialog(props: AttachMemoryBlockDialogProps) {
  const { trigger } = props;
  const [open, setOpen] = useState(false);
  const t = useTranslations('ADE/AttachMemoryBlockDialog');

  const { projectId } = useADEAppContext();
  const { data: enabled } = useFeatureFlag('MEMORY_BLOCK_VIEWER');
  const { isTemplate } = useADEState();

  if (!enabled || isTemplate) {
    return null;
  }

  return (
    <Dialog
      isOpen={open}
      size="xlarge"
      disableForm
      fullHeight
      hideFooter
      onOpenChange={setOpen}
      title={t('title')}
      trigger={trigger}
    >
      <VStack paddingBottom collapseHeight fullWidth overflow="hidden">
        {open && <SearchMemoryBlocks projectId={projectId} />}
      </VStack>
    </Dialog>
  );
}
