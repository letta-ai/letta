import * as React from 'react';
import { useCallback } from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import { Button } from '../../core/Button/Button';
import { usePanelContext, usePanelManagerContext } from '../Panel/Panel';

interface PanelHeaderProps {
  title: string;
  showSave?: boolean;
  isSaving?: boolean;
}

export function PanelHeader(props: PanelHeaderProps) {
  const { title, showSave, isSaving } = props;
  const { id } = usePanelContext();
  const { deactivatePanel } = usePanelManagerContext();

  const handleDeactivatePanel = useCallback(
    function handleDeactivatePanel() {
      deactivatePanel(id);
    },
    [deactivatePanel, id]
  );

  return (
    <HStack
      color="background-greyer"
      align="center"
      padding="xxsmall"
      borderBottom
      justify="spaceBetween"
      className="h-panel"
    >
      <Typography bold>{title}</Typography>
      <HStack fullHeight align="center">
        <Button
          onClick={handleDeactivatePanel}
          label="Close"
          size="small"
          color="tertiary"
        />
        {showSave && (
          <Button
            busy={isSaving}
            type="submit"
            label="Save"
            size="small"
            color="secondary"
          />
        )}
      </HStack>
    </HStack>
  );
}
