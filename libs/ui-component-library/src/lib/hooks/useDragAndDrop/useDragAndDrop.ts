'use client';

import { useCallback, useState } from 'react';

export interface UseDragAndDropOptions {
  onFilesSelected: (files: FileList) => void;
  acceptMultiple?: boolean;
  restrictMultipleFiles?: boolean;
  dropZoneRef: React.RefObject<HTMLElement | null>;
}

export interface UseDragAndDropReturn {
  isDragging: boolean;
  isMultipleFiles: boolean;
  handleDragEnter: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function useDragAndDrop({
  onFilesSelected,
  acceptMultiple = true,
  restrictMultipleFiles = false,
  dropZoneRef,
}: UseDragAndDropOptions): UseDragAndDropReturn {
  const [isDragging, setIsDragging] = useState(false);
  const [isMultipleFiles, setIsMultipleFiles] = useState(false);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const fileItems = Array.from(e.dataTransfer.items).filter(
          (item) => item.kind === 'file',
        );

        if (fileItems.length > 0) {
          setIsDragging(true);

          if (restrictMultipleFiles && !acceptMultiple) {
            setIsMultipleFiles(fileItems.length > 1);
          }
        }
      }
    },
    [acceptMultiple, restrictMultipleFiles],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const dropZone = dropZoneRef.current;
      const relatedTarget = e.relatedTarget as Node;

      if (dropZone && (!relatedTarget || !dropZone.contains(relatedTarget))) {
        setIsDragging(false);
        setIsMultipleFiles(false);
      }
    },
    [dropZoneRef],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (restrictMultipleFiles && !acceptMultiple && e.dataTransfer.items) {
        const fileItems = Array.from(e.dataTransfer.items).filter(
          (item) => item.kind === 'file',
        );
        if (fileItems.length > 1) {
          e.dataTransfer.dropEffect = 'none';
        }
      }
    },
    [acceptMultiple, restrictMultipleFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setIsMultipleFiles(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        if (!acceptMultiple && files.length > 1) {
          const singleFileList = new DataTransfer();
          singleFileList.items.add(files[0]);
          onFilesSelected(singleFileList.files);
        } else {
          onFilesSelected(files);
        }
      }
    },
    [onFilesSelected, acceptMultiple],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFilesSelected(files);
      }
    },
    [onFilesSelected],
  );

  return {
    isDragging,
    isMultipleFiles,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileInputChange,
  };
}
