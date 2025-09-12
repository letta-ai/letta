'use client';
import * as React from 'react';
import { useCallback, useRef, useState, useEffect } from 'react';
import { makeInput, makeRawInput } from '../Form/Form';
import { Typography } from '../Typography/Typography';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { FileIcon, TrashIcon } from '../../icons';
import { Button } from '../Button/Button';
import { Tooltip } from '../Tooltip/Tooltip';
import { useTranslations } from '@letta-cloud/translations';
import { ACCEPTABLE_FILETYPES } from '@letta-cloud/sdk-core';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@letta-cloud/ui-styles';
import { useDragAndDrop } from '../../hooks/useDragAndDrop/useDragAndDrop';
import { useFormatters } from '@letta-cloud/utils-client';

interface MultiFileUploadProps {
  onChange: (files: File[]) => void;
  value: File[];
  maxFiles?: number;
  maxSizePerFile?: number;
  removeFileText?: string;
  changeFilesText?: string;
  chooseFilesText?: string;
  fileIcon?: React.ReactNode;
  dropText?: string;
  dropHereText?: string;
  accept?: string;
  disabled?: boolean;
  onFileErrorsChange?: (hasErrors: boolean) => void;
}

function MultiFileUploadPrimitive(props: MultiFileUploadProps) {
  const t = useTranslations('components/MultiFileUpload');
  const { dynamicFileSize } = useFormatters();

  const {
    onChange,
    value = [],
    maxFiles,
    maxSizePerFile,
    dropText = t('dropFiles'),
    dropHereText = t('dropFilesHere'),
    removeFileText = t('removeFile'),
    fileIcon = <FileIcon />,
    chooseFilesText = t('chooseFilesText'),
    accept,
    disabled = false,
    onFileErrorsChange,
  } = props;

  const inputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLElement>(null);

  const [filesWithExceededSize, setFilesWithExceededSize] = useState<
    Set<number>
  >(new Set());
  const [filesWithUnsupportedTypes, setFilesWithUnsupportedTypes] = useState<
    Set<number>
  >(new Set());

  const updateErrorSets = useCallback(
    (files: File[], startIndex: number = 0) => {
      files.forEach((file, index) => {
        const actualIndex = startIndex + index;

        // Check file size
        if (maxSizePerFile && file.size > maxSizePerFile) {
          setFilesWithExceededSize((prev) => new Set([...prev, actualIndex]));
        }

        // Check file type
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!ACCEPTABLE_FILETYPES.includes(fileExtension)) {
          setFilesWithUnsupportedTypes(
            (prev) => new Set([...prev, actualIndex]),
          );
        }
      });
    },
    [maxSizePerFile],
  );

  const handleFilesSelected = useCallback(
    (files: FileList) => {
      const newFiles = Array.from(files);

      // Check if we can add more files
      if (maxFiles && value.length + newFiles.length > maxFiles) {
        const allowedCount = maxFiles - value.length;
        if (allowedCount <= 0) {
          return;
        }
        newFiles.splice(allowedCount);
      }

      const updatedFiles = [...value, ...newFiles];

      // Clear existing error sets and rebuild them
      setFilesWithExceededSize(new Set());
      setFilesWithUnsupportedTypes(new Set());

      // Check all files for errors
      updateErrorSets(updatedFiles);

      onChange(updatedFiles);
    },
    [onChange, value, maxFiles, updateErrorSets],
  );

  const updateIndicesAfterRemoval = useCallback(
    (removedIndex: number, errorSet: Set<number>) => {
      const newSet = new Set<number>();
      errorSet.forEach((errorIndex) => {
        if (errorIndex < removedIndex) {
          // Indices before the removed file stay the same
          newSet.add(errorIndex);
        } else if (errorIndex > removedIndex) {
          // Indices after the removed file shift down by 1
          newSet.add(errorIndex - 1);
        }
        // Don't add the removed index itself
      });
      return newSet;
    },
    [],
  );

  const removeFile = useCallback(
    (index: number) => {
      const newFiles = value.filter((_, i) => i !== index);
      onChange(newFiles);

      // Update error sets to account for index shifting
      setFilesWithExceededSize((prev) =>
        updateIndicesAfterRemoval(index, prev),
      );
      setFilesWithUnsupportedTypes((prev) =>
        updateIndicesAfterRemoval(index, prev),
      );
    },
    [value, onChange, updateIndicesAfterRemoval],
  );

  const {
    isDragging: isDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileInputChange,
  } = useDragAndDrop({
    onFilesSelected: handleFilesSelected,
    acceptMultiple: true,
    dropZoneRef,
  });

  const triggerChooseFiles = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const getDropText = useCallback(() => {
    if (maxFiles && value.length >= maxFiles) {
      return t('maxFilesReached', { max: maxFiles });
    }
    return isDragOver ? dropHereText : dropText;
  }, [maxFiles, value.length, isDragOver, dropHereText, dropText, t]);

  const getDropZoneStyle = useCallback(() => {
    if (maxFiles && value.length >= maxFiles && isDragOver) {
      return 'bg-destructive/10 border-destructive border-2 border-dashed';
    }
    if (isDragOver) {
      return 'bg-primary/10 border-primary border-2 border-dashed';
    }
    return '';
  }, [maxFiles, value.length, isDragOver]);

  const getTooltipContent = useCallback(
    (index: number) => {
      const hasExceededSize = filesWithExceededSize.has(index);
      const hasUnsupportedType = filesWithUnsupportedTypes.has(index);

      if (hasExceededSize && hasUnsupportedType) {
        return 'File exceeds size limit and has unsupported type';
      }
      if (hasExceededSize) {
        return 'File exceeds size limit';
      }
      if (hasUnsupportedType) {
        return 'Unsupported file type';
      }
      return undefined;
    },
    [filesWithExceededSize, filesWithUnsupportedTypes],
  );

  const canAddMore = !maxFiles || value.length < maxFiles;

  const hasFileErrors = useCallback(
    (index: number) =>
      filesWithExceededSize.has(index) || filesWithUnsupportedTypes.has(index),
    [filesWithExceededSize, filesWithUnsupportedTypes],
  );

  // Check if any files have errors and notify parent
  useEffect(() => {
    if (onFileErrorsChange) {
      const hasAnyErrors = value.some((_, index) => hasFileErrors(index));
      onFileErrorsChange(hasAnyErrors);
    }
  }, [
    value,
    filesWithExceededSize,
    filesWithUnsupportedTypes,
    onFileErrorsChange,
    hasFileErrors,
  ]);

  return (
    <VStack fullWidth gap="medium">
      {/* Drop Zone */}
      <VStack
        ref={dropZoneRef}
        fullWidth
        color="background-grey"
        className={cn(
          'w-full h-[150px] relative transition-colors duration-200',
          getDropZoneStyle(),
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        onDrop={!disabled ? handleDrop : undefined}
        onDragEnter={!disabled ? handleDragEnter : undefined}
        onDragLeave={!disabled ? handleDragLeave : undefined}
        onDragOver={!disabled ? handleDragOver : undefined}
        align="center"
        justify="center"
      >
        <VStack align="center">
          <Slot className="w-8">{fileIcon}</Slot>
          <VStack>
            <Typography
              variant="body"
              className={cn(
                'text-center',
                !canAddMore && isDragOver && 'text-destructive',
              )}
            >
              {getDropText()}
            </Typography>
            <Button
              type="button"
              onClick={triggerChooseFiles}
              color="secondary"
              label={chooseFilesText}
              disabled={disabled || !canAddMore}
            />
          </VStack>
        </VStack>
      </VStack>

      {/* File List */}
      {value.length > 0 && (
        <VStack fullWidth gap="small">
          {value.map((file, index) => {
            const tooltipContent = getTooltipContent(index);
            const fileInfoContent = (
              <HStack
                align="center"
                gap="small"
                flex
                className={cn('cursor-default')}
              >
                {fileIcon}
                <Typography variant="body" className="truncate">
                  {file.name}
                </Typography>
                <Typography variant="body3" color="lighter">
                  ({dynamicFileSize(file.size)})
                </Typography>
              </HStack>
            );

            return (
              <HStack
                key={`${file.name}-${index}`}
                align="center"
                padding="small"
                border
                fullWidth
                justify="spaceBetween"
                color={hasFileErrors(index) ? 'destructive' : undefined}
              >
                {tooltipContent ? (
                  <Tooltip content={tooltipContent} asChild={true}>
                    {fileInfoContent}
                  </Tooltip>
                ) : (
                  fileInfoContent
                )}

                <Button
                  onClick={() => removeFile(index)}
                  color="tertiary"
                  size="small"
                  hideLabel
                  preIcon={<TrashIcon />}
                  label={removeFileText}
                  disabled={disabled}
                />
              </HStack>
            );
          })}
        </VStack>
      )}

      {/* Hidden File Input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        multiple
        disabled={disabled || !canAddMore}
      />
    </VStack>
  );
}

export const MultiFileUpload = makeInput(
  MultiFileUploadPrimitive,
  'MultiFileUpload',
);
export const RawMultiFileUpload = makeRawInput(
  MultiFileUploadPrimitive,
  'RawMultiFileUpload',
);
