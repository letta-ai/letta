import {
  Panel,
  PanelMainContent,
  RawInput,
} from '@letta-web/component-library';
import React from 'react';
import { useCurrentAgent } from '../hooks';
import { ADENavigationItem } from '../common/ADENavigationItem/ADENavigationItem';

export function ConfigPanel() {
  const { id } = useCurrentAgent();

  return (
    <Panel
      title="Start using the SDK"
      id="SDK"
      trigger={<ADENavigationItem title="Settings" />}
    >
      <PanelMainContent>
        <RawInput fullWidth label="SDK Agent ID" allowCopy value={id} />
      </PanelMainContent>
    </Panel>
  );
}
