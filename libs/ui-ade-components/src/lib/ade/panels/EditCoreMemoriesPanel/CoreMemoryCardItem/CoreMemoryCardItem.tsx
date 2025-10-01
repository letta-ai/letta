import React from 'react';
import {
  CoreMemoryCard,
  type SharedAgent,
} from '@letta-cloud/ui-component-library';
import type { Block } from '@letta-cloud/sdk-core';
import { useSharedAgents } from '../../../../hooks/useSharedAgents/useSharedAgents';

interface CoreMemoryCardItemProps {
  block: Block;
  handleBlockClick: (label: string) => void;
  isSelected: boolean;
}

export function CoreMemoryCardItem({
  block,
  handleBlockClick,
  isSelected,
}: CoreMemoryCardItemProps) {
  let sharedAgents: SharedAgent[] | undefined;
  if (block.id) {
    sharedAgents = useSharedAgents(block.id);
  }

  return (
    <CoreMemoryCard
      label={block.label}
      sharedAgents={sharedAgents}
      openInAdvanced={() => {
        if (!block.label) return;
        handleBlockClick(block.label);
      }}
      value={block.value}
      readOnly={block.read_only}
      preserveOnMigration={block.preserve_on_migration}
      isSelected={isSelected}
    />
  );
}
