'use client';
import * as React from 'react';
import { useCallback, useRef } from 'react';
import { makeInput, makeRawInput } from '../Form/Form';
import { Typography } from '../Typography/Typography';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { FileIcon, TrashIcon } from '../../icons';
import { Button } from '../Button/Button';
import { useTranslations } from '@letta-cloud/translations';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@letta-cloud/ui-styles';
import { useDragAndDrop } from '../../hooks/useDragAndDrop/useDragAndDrop';
import { useFormatters } from '@letta-cloud/utils-client';


interface MultiFileUploadProps {
  onChange: (files: File[]) => void;
  value: File[];
  maxFiles?: number;
  removeFileText?: string;
  changeFilesText?: string;
  chooseFilesText?: string;
  fileIcon?: React.ReactNode;
  dropText?: string;
  dropHereText?: string;
  accept?: string;
  disabled?: boolean;
}

function MultiFileUploadPrimitive(props: MultiFileUploadProps) {
  const t = useTranslations('components/MultiFileUpload');
  const { dynamicFileSize } = useFormatters();

  const {
    onChange,
    value = [],
    maxFiles,
    dropText = t('dropFiles'),
    dropHereText = t('dropFilesHere'),
    removeFileText = t('removeFile'),
    fileIcon = <FileIcon />,
    chooseFilesText = t('chooseFilesText'),
    accept,
    disabled = false,
  } = props;

  const inputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLElement>(null);

  const handleFilesSelected = useCallback(
    (files: FileList) => {
      const newFiles = Array.from(files);

      if (maxFiles && value.length + newFiles.length > maxFiles) {
        const allowedCount = maxFiles - value.length;
        if (allowedCount <= 0) {
          return;
        }
        newFiles.splice(allowedCount);
      }

      const updatedFiles = [...value, ...newFiles];
      onChange(updatedFiles);
    },
    [onChange, value, maxFiles]
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

  const removeFile = useCallback(
    (index: number) => {
      const newFiles = value.filter((_, i) => i !== index);
      onChange(newFiles);
    },
    [value, onChange]
  );



  function getDropText() {
    if (maxFiles && value.length >= maxFiles) {
      return t('maxFilesReached', { max: maxFiles });
    }
    return isDragOver ? dropHereText : dropText;
  }

  function getDropZoneStyle() {
    if (maxFiles && value.length >= maxFiles && isDragOver) {
      return 'bg-destructive/10 border-destructive border-2 border-dashed';
    }
    if (isDragOver) {
      return 'bg-primary/10 border-primary border-2 border-dashed';
    }
    return '';
  }

  const canAddMore = !maxFiles || value.length < maxFiles;

  return (
    <VStack fullWidth gap="medium">
      <VStack
        ref={dropZoneRef}
        fullWidth
        color="background-grey"
        className={cn(
          'w-full h-[150px] relative transition-colors duration-200',
          getDropZoneStyle(),
          disabled && 'opacity-50 cursor-not-allowed'
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
                (!canAddMore && isDragOver) && 'text-destructive'
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

      {value.length > 0 && (
        <VStack fullWidth gap="small">
          {value.map((file, index) => (
            <HStack
              key={`${file.name}-${index}`}
              align="center"
              padding="small"
              border
              fullWidth
              justify="spaceBetween"
            >
              <HStack align="center" gap="small" flex>
                {fileIcon}
                <Typography variant="body" className="truncate">
                  {file.name}
                </Typography>
                <Typography variant="body3" color="lighter">
                  ({dynamicFileSize(file.size)})
                </Typography>
              </HStack>
              <Button
                onClick={() => {
                  removeFile(index);
                }}
                color="tertiary"
                size="small"
                hideLabel
                preIcon={<TrashIcon />}
                label={removeFileText}
                disabled={disabled}
              />
            </HStack>
          ))}
        </VStack>
      )}
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

export const MultiFileUpload = makeInput(MultiFileUploadPrimitive, 'MultiFileUpload');

export const RawMultiFileUpload = makeRawInput(MultiFileUploadPrimitive, 'RawMultiFileUpload');
