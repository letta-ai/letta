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

interface SingleFileUploadProps {
  onChange: (file: File | undefined) => void;
  value: File;
  removeFileText?: string;
  changeFileText?: string;
  chooseFileText?: string;
  fileIcon?: React.ReactNode;
  dropText?: string;
  accept?: string;
}

function SingleFileUploadPrimitive(props: SingleFileUploadProps) {
  const t = useTranslations('components/SingleFileUpload');

  const {
    onChange,
    value,
    dropText = t('dropFile'),
    removeFileText = t('removeFile'),
    changeFileText = t('changeFile'),
    fileIcon = <FileIcon />,
    chooseFileText = t('chooseFileText'),
    accept,
  } = props;

  const handleDropFile = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      onChange(file);
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

  return (
    <VStack
      fullWidth
      color="background-grey"
      className="w-full h-[250px] relative"
      onDrop={handleDropFile}
      align="center"
      justify="center"
      onDragOver={(event) => {
        event.preventDefault();
      }}
    >
      {!value ? (
        <>
          <VStack align="center">
            <Slot className="w-8">{fileIcon}</Slot>
            <VStack>
              <Typography variant="body" className="text-center">
                {dropText}
              </Typography>
              <Button
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
              label={changeFileText}
            ></Button>
            <Button
              onClick={() => {
                onChange(undefined);
              }}
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
        className="w-[0] h-[0] absolute opacity-0"
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
