'use client';
import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { useState } from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { cn } from '@letta-cloud/ui-styles';
import { Typography } from '../../core/Typography/Typography';
import { RadioDot } from '../../core/RadioDot/RadioDot';
import './VersionHistory.scss';

export interface VersionData {
  title: string;
  message?: string;
  details: React.ReactNode;
  subtitle?: string;
}

interface VersionHistoryItemProps {
  version: VersionData;
  onSelect: () => void;
  isSelected: boolean;
  isFirst?: boolean;
}

function VersionHistoryItem(props: VersionHistoryItemProps) {
  const { version, isFirst, isSelected, onSelect } = props;

  return (
    <HStack
      fullWidth
      as="button"
      onClick={() => {
        onSelect();
      }}
      paddingX="small"
      paddingY="small"
      className={cn(isSelected ? 'bg-background-grey2' : '', 'min-h-[66px]')}
      align="center"
      gap="large"
    >
      <div className="w-4 h-4 flex items-center justify-center">
        <RadioDot
          variant={isFirst ? 'lsd' : 'filled'}
          size={isFirst ? 'medium' : 'small'}
          checked={isSelected}
        />
      </div>
      <VStack collapseWidth flex gap={false}>
        <Typography noWrap className="" overflow="ellipsis" fullWidth>
          {version.title}
        </Typography>
        <Typography
          color="muted"
          noWrap
          className="line-clamp-1"
          overflow="ellipsis"
          fullWidth
        >
          {version.subtitle}
        </Typography>
        {isSelected && version.message ? (
          <VStack paddingY="small">
            <VStack borderLeft paddingX="small">
              <Typography color="lighter" fullWidth variant="body2">
                {version.message}
              </Typography>
            </VStack>
          </VStack>
        ) : null}
      </VStack>
    </HStack>
  );
}

interface VersionHistoryListProps {
  versions: VersionData[];
  onSetSelectedVersionIndex: (index: number) => void;
  selectedVersionIndex: number;
  loadMoreButton?: React.ReactNode;
}

function VersionHistoryList(props: VersionHistoryListProps) {
  const {
    versions,
    loadMoreButton,
    onSetSelectedVersionIndex,
    selectedVersionIndex,
  } = props;

  return (
    <VStack width="sidebar" padding="medium" gap={false}>
      {versions.map((version, index) => (
        <div className="relative w-full" key={index}>
          {index !== 0 && versions.length > 0 && (
            <div className="version-history-line absolute w-[1px] bg-background-grey3 top-[0] mb-[8px] left-[17.5px]" />
          )}
          <VersionHistoryItem
            isFirst={index === 0}
            key={version.subtitle}
            version={version}
            onSelect={() => {
              onSetSelectedVersionIndex(index);
            }}
            isSelected={selectedVersionIndex === index}
          />
          {index !== versions.length - 1 && (
            <div className="version-history-line absolute w-[1px] bg-background-grey3 top-[50%] mt-[8px] left-[17.5px]" />
          )}
        </div>
      ))}
      {loadMoreButton}
    </VStack>
  );
}

interface VersionHistoryProps {
  versions: VersionData[];
  loadMoreButton?: React.ReactNode;
}

export function VersionHistory(props: VersionHistoryProps) {
  const { versions, loadMoreButton } = props;
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0);

  return (
    <HStack fullHeight fullWidth color="background-grey" gap={false}>
      <VersionHistoryList
        versions={versions}
        onSetSelectedVersionIndex={setSelectedVersionIndex}
        selectedVersionIndex={selectedVersionIndex}
        loadMoreButton={loadMoreButton}
      />
      <VStack flex fullWidth gap={false} color="background-grey2">
        {versions[selectedVersionIndex]?.details}
      </VStack>
    </HStack>
  );
}
