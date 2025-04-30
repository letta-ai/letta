import { useState } from 'react';
import {
  Button,
  SideOverlay,
  CodeIcon,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

export function DetailedMessageView() {
  const t = useTranslations('ADE/AgentSimulator');
  const [debugWindowOpen, setDebugWindowOpen] = useState(false);

  return (
    <>
      <Button
        preIcon={<CodeIcon />}
        onClick={() => {
          setDebugWindowOpen(true);
        }}
        size="xsmall"
        hideLabel
        label={t('setChatroomRenderMode.options.debug')}
        property="square"
        color="tertiary"
      />

      <SideOverlay
        isOpen={debugWindowOpen}
        onOpenChange={setDebugWindowOpen}
        title={t('setChatroomRenderMode.options.debug')}
      >
        here
      </SideOverlay>
    </>
  );
}
