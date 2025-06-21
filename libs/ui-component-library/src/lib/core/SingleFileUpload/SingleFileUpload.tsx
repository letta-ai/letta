'use client';
import * as React from 'react';
import { useCallback, useRef, useState } from 'react';
import { makeInput, makeRawInput } from '../Form/Form';
import { Typography } from '../Typography/Typography';
import { VStack } from '../../framing/VStack/VStack';
import { FileIcon } from '../../icons';
import { Button } from '../Button/Button';
import { HStack } from '../../framing/HStack/HStack';
import { useTranslations } from '@letta-cloud/translations';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@letta-cloud/ui-styles';

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

  const [isDragOver, setIsDragOver] = useState(false);
  const [isMultipleFiles, setIsMultipleFiles] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragCounter.current++;

      if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
        const fileItems = Array.from(event.dataTransfer.items).filter(
          (item) => item.kind === 'file',
        );

        if (fileItems.length > 0) {
          setIsDragOver(true);
          setIsMultipleFiles(fileItems.length > 1);
        }
      }
    },
    [],
  );

  const handleDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragCounter.current--;
      if (dragCounter.current === 0) {
        setIsDragOver(false);
        setIsMultipleFiles(false);
      }
    },
    [],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      // Show not-allowed cursor for multiple files
      if (event.dataTransfer.items) {
        const fileItems = Array.from(event.dataTransfer.items).filter(
          (item) => item.kind === 'file',
        );
        if (fileItems.length > 1) {
          event.dataTransfer.dropEffect = 'none';
        }
      }
    },
    [],
  );

  const handleDropFile = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragCounter.current = 0;
      setIsDragOver(false);
      setIsMultipleFiles(false);

      const files = event.dataTransfer.files;

      // Only accept the first file if multiple are dropped
      if (files.length > 0) {
        const file = files[0];
        onChange(file);
      }
    },
    [onChange],
  );

  const inputRef = useRef<HTMLInputElement>(null);

  const handleChooseFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      onChange(file);
    },
    [onChange],
  );

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
      fullWidth
      color="background-grey"
      className={cn(
        'w-full h-[250px] relative transition-colors duration-200',
        getDropZoneStyle(),
      )}
      onDrop={handleDropFile}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      align="center"
      justify="center"
    >
      {!value ? (
        <>
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
        </>
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
        onChange={handleChooseFile}
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
