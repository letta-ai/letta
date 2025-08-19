import React from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import type { FileMetadata } from '@letta-cloud/sdk-core';
import { FileView } from './FileView/FileView';
import { SkeletonFileView } from './FileView/SkeletonFileView';
import { FILE_VIEW_HEIGHT } from '../../../constants';

interface VirtualizedFilesContainerProps {
  files: FileMetadata[];
  isDragging?: boolean;
  onDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
}

interface FileItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    files: FileMetadata[];
  };
}

function FileItem({ index, style, data }: FileItemProps) {



  // Bounds checking to prevent errors at the bottom
  const file = data.files[index];

  if (!file) {
    return (
      <div style={style}>
        <div style={{ padding: '1px 2px', marginBottom: '8px' }}>
          <SkeletonFileView />
        </div>
      </div>
    );
  }

  return (
    <div style={style}>
      <div style={{ padding: '1px 2px', marginBottom: '8px' }}>
        <FileView file={file} />
      </div>
    </div>
  );
}

function VirtualizedFilesContainer(props: VirtualizedFilesContainerProps) {
  const {
    files
  } = props;
  const itemCount = files?.length || 0;

  // Calculate the height accounting for padding and gap
  const itemSize = FILE_VIEW_HEIGHT + 2 + 8; // 2px for padding + 8px margin bottom

  return (
    <AutoSizer>
      {({ height, width }) => (
        <List
          height={height}
          width={width}
          itemCount={itemCount}
          itemSize={itemSize}
          itemData={{ files }}
          overscanCount={10}
          useIsScrolling={true}
          className="scrollbar-thin scrollbar-thumb-background-grey3 scrollbar-track-transparent"
        >
          {FileItem}
        </List>
      )}
    </AutoSizer>
  );
}

VirtualizedFilesContainer.displayName = 'VirtualizedFilesContainer';

export { VirtualizedFilesContainer };
