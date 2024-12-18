'use client';
import * as React from 'react';
import { useCallback, useRef } from 'react';
import { makeInput, makeRawInput } from '../Form/Form';
import { Typography } from '../Typography/Typography';
import { VStack } from '../../framing/VStack/VStack';
import { FileIcon } from '../../icons';
import { Button } from '../Button/Button';
import { HStack } from '../../framing/HStack/HStack';

interface SingleFileUploadProps {
  onChange: (file: File | undefined) => void;
  value: File;
}

function SingleFileUploadPrimitive(props: SingleFileUploadProps) {
  const { onChange, value } = props;

  const handleDropFile = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      onChange(file);
    },
    [onChange]
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
    [onChange]
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
            <FileIcon className="w-8" />
            <VStack>
              <Typography variant="body" className="text-center">
                Drop a file here
              </Typography>
              <Button
                onClick={triggerChooseFile}
                color="tertiary"
                label="Choose file"
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
            <FileIcon />
            <Typography variant="body" className="text-center">
              {value.name}
            </Typography>
          </HStack>
          <HStack>
            <Button
              onClick={triggerChooseFile}
              color="tertiary"
              label="Change file"
            ></Button>
            <Button
              onClick={() => {
                onChange(undefined);
              }}
              color="destructive"
              label="Remove file"
            ></Button>
          </HStack>
        </VStack>
      )}
      <input
        ref={inputRef}
        type="file"
        className="w-[0] h-[0] absolute opacity-0"
        onChange={handleChooseFile}
      />
    </VStack>
  );
}

export const SingleFileUpload = makeInput(
  SingleFileUploadPrimitive,
  'SingleFileUpload'
);
export const RawSingleFileUpload = makeRawInput(
  SingleFileUploadPrimitive,
  'RawSingleFileUpload'
);
