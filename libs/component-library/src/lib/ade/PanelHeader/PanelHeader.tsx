import * as React from 'react';
import { useCallback } from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import { usePanelContext, usePanelManagerContext } from '../Panel/Panel';
import { Cross2Icon } from '../../icons';

export interface PanelHeaderProps {
  title: string[] | string;
  onGoBack?: () => void;
}

export function PanelHeader(props: PanelHeaderProps) {
  const { title, onGoBack } = props;
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
      color="background"
      align="center"
      padding="xxsmall"
      borderBottom
      justify="spaceBetween"
      className="h-panel"
    >
      {Array.isArray(title) ? (
        <HStack gap="small">
          {title.map((t, i) => (
            <>
              <button
                key={i}
                onClick={() => {
                  if (i === 0 && onGoBack) {
                    onGoBack();
                  }
                }}
              >
                <Typography className="hover:underline" key={i} bold>
                  {t}
                </Typography>
              </button>
              {i < title.length - 1 && <Typography key={`${i}n`}>/</Typography>}
            </>
          ))}
          {onGoBack && (
            <button
              type="button"
              onClick={onGoBack}
              className="flex items-center text-xs rounded-full bg-background-greyer px-2"
            >
              Go back
            </button>
          )}
        </HStack>
      ) : (
        <Typography bold>{title}</Typography>
      )}
      <button
        type="button"
        onClick={handleDeactivatePanel}
        className="flex items-center"
      >
        <Cross2Icon />
        <span className="sr-only">Close</span>
      </button>
    </HStack>
  );
}
