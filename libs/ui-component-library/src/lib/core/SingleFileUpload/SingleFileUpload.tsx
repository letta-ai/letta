'use client';
import * as React from 'react';
import { useCallback, useRef } from 'react';
import { makeInput, makeRawInput } from '../Form/Form';
import { Typography } from '../Typography/Typography';
import { VStack } from '../../framing/VStack/VStack';
import { FileIcon } from '../../icons';
import { Button } from '../Button/Button';
import { HStack } from '../../framing/HStack/HStack';
import { useTranslations } from '@letta-cloud/translations';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@letta-cloud/ui-styles';
import { useDragAndDrop } from '../../hooks/useDragAndDrop/useDragAndDrop';

interface SingleFileUploadProps {
  onChange: (file: File | undefined) => void;
  value: File;
  removeFileText?: string;
  changeFileText?: string;
  chooseFileText?: string;
  fileIcon?: React.ReactNode;
  dropText?: string;
  dropHereText?: string;
  accept?: string;
}

function SingleFileUploadPrimitive(props: SingleFileUploadProps) {
  const t = useTranslations('components/SingleFileUpload');

  const {
    onChange,
    value,
    dropText = t('dropFile'),
    dropHereText = t('dropFileHere'),
    removeFileText = t('removeFile'),
    changeFileText = t('changeFile'),
    fileIcon = <FileIcon />,
    chooseFileText = t('chooseFileText'),
    accept,
  } = props;

  const inputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLElement>(null);

  const handleFilesSelected = useCallback(
    (files: FileList) => {
      if (files.length > 0) {
        const file = files[0];
        onChange(file);
      }
    },
    [onChange],
  );

  const {
    isDragging: isDragOver,
    isMultipleFiles,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileInputChange,
  } = useDragAndDrop({
    onFilesSelected: handleFilesSelected,
    acceptMultiple: false,
    restrictMultipleFiles: true,
    dropZoneRef,
  });

  const triggerChooseFile = useCallback(() => {
    inputRef.current?.click();
  }, []);

  function getDropText() {
    if (isMultipleFiles) {
      return t('onlyOneFile');
    }
    return isDragOver ? dropHereText : dropText;
  }

  function getDropZoneStyle() {
    if (isMultipleFiles) {
      return 'bg-destructive/10 border-destructive border-2 border-dashed';
    }
    if (isDragOver) {
      return 'bg-primary/10 border-primary border-2 border-dashed';
    }
    return '';
  }

  return (
    <VStack
      ref={dropZoneRef}
      fullWidth
      color="background-grey"
      className={cn(
        'w-full h-[250px] relative transition-colors duration-200',
        getDropZoneStyle(),
      )}
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      align="center"
      justify="center"
    >
      {!value ? (
        <VStack align="center">
          <Slot className="w-8">{fileIcon}</Slot>
          <VStack>
            <Typography
              variant="body"
              className={cn(
                'text-center',
                isMultipleFiles && 'text-destructive',
              )}
            >
              {getDropText()}
            </Typography>
            <Button
              type="button"
              onClick={triggerChooseFile}
              color="secondary"
              label={chooseFileText}
            ></Button>
          </VStack>
        </VStack>
      ) : (
        <VStack align="center">
          <HStack
            align="center"
            border
            padding="small"
            fullWidth
            justify="center"
          >
            {fileIcon}
            <Typography variant="body" className="text-center">
              {value.name}
            </Typography>
          </HStack>
          <HStack>
            <Button
              onClick={triggerChooseFile}
              color="secondary"
              type="button"
              label={changeFileText}
            ></Button>
            <Button
              onClick={() => {
                onChange(undefined);
              }}
              type="button"
              color="destructive"
              label={removeFileText}
            ></Button>
          </HStack>
        </VStack>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="w-[0] h-0] absolute opacity-0"
        onChange={handleFileInputChange}
      />
    </VStack>
  );
}

export const SingleFileUpload = makeInput(
  SingleFileUploadPrimitive,
  'SingleFileUpload',
);
export const RawSingleFileUpload = makeRawInput(
  SingleFileUploadPrimitive,
  'RawSingleFileUpload',
);
