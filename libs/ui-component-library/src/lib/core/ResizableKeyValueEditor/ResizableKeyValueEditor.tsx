'use client';
import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { HR } from '../HR/HR';
import { useTranslations } from '@letta-cloud/translations';
import { Typography } from '../Typography/Typography';
import { HStack } from '../../framing/HStack/HStack';
import { PlusIcon, TrashIcon } from '../../icons';
import { Tooltip } from '../Tooltip/Tooltip';
import { cn } from '@letta-cloud/ui-styles';
import { Button } from '../Button/Button';

interface RowProps {
  keyCell: React.ReactNode;
  valueCell: React.ReactNode;
  width: number;
}

function Row(props: RowProps) {
  const { keyCell, valueCell, width } = props;

  return (
    <div className="w-full  relative  flex flex-row">
      <div style={{ width: `${width}%` }}>{keyCell}</div>
      <VStack overflow="hidden" flex gap={false}>
        {valueCell}
        <div className="absolute bottom-0 w-full left-0">
          <HR />
        </div>
      </VStack>
    </div>
  );
}

interface TitleCellProps {
  children: React.ReactNode;
}

function TitleCell(props: TitleCellProps) {
  const { children } = props;

  return (
    <div className="px-2 pb-1 pt-2">
      <Typography bold variant="body4" uppercase color="muted">
        {children}
      </Typography>
    </div>
  );
}

interface DefinitionRowProps {
  definition: ResizableKeyValueEditorDefinition;
  index: number;
  disableValueInput?: boolean;
  width: number;
  handleDeleteDefinition: (index: number) => void;
  handleValueChange: (index: number, newValue: string) => void;
  handleKeyChange: (index: number, newKey: string) => void;
  disableKeyInput?: boolean;
  disableDeleteDefinition?: boolean;
}

function DefinitionRow(props: DefinitionRowProps) {
  const {
    definition,
    index,
    width,
    handleDeleteDefinition,
    handleValueChange,
    disableValueInput,
    handleKeyChange,
    disableKeyInput,
    disableDeleteDefinition,
  } = props;

  const t = useTranslations('components/ResizableKeyValueEditor');

  return (
    <Row
      key={index}
      width={width}
      keyCell={
        <HStack
          paddingX="small"
          align="center"
          fullWidth
          justify="spaceBetween"
        >
          <input
            placeholder={t('keyPlaceholder')}
            className=" focus:outline-0  py-2  pt-3 w-full bg-transparent text-xs font-mono "
            value={definition.key}
            disabled={disableKeyInput || definition.disableKeyInput}
            onChange={(e) => {
              handleKeyChange(index, e.target.value);
            }}
          />
          {definition.keyBadge}
        </HStack>
      }
      valueCell={
        <HStack
          color={
            disableValueInput || definition.disableValueInput
              ? 'background-grey'
              : 'background'
          }
          paddingX="small"
          align="center"
          fullWidth
        >
          <TextareaAutosize
            key={definition.key}
            placeholder={definition.valuePlaceholder || t('placeholder')}
            disabled={disableValueInput || definition.disableValueInput}
            className={cn(
              'py-2  pt-3 w-full min-w-[100px] resize-none focus:outline-none  focus:outline-0 text-xs font-mono  bg-transparent',
            )}
            value={definition.value}
            onChange={(e) => {
              handleValueChange(index, e.target.value);
            }}
          />
          <HStack paddingX="small">
            {definition.valueBadge}
            {!disableDeleteDefinition && !definition.disableDelete && (
              <Tooltip content={t('deleteDefinition')}>
                <Button
                  label={t('deleteDefinition')}
                  onClick={() => {
                    handleDeleteDefinition(index);
                  }}
                  hideLabel
                  square
                  size="xsmall"
                  color="tertiary"
                  preIcon={<TrashIcon />}
                ></Button>
              </Tooltip>
            )}
          </HStack>
        </HStack>
      }
    ></Row>
  );
}

export interface ResizableKeyValueEditorDefinition {
  key: string;
  value: string;
  keyBadge?: React.ReactNode;
  valueBadge?: React.ReactNode;
  valuePlaceholder?: string;
  disableKeyInput?: boolean;
  disableValueInput?: boolean;
  disableDelete?: boolean;
}

interface ResizableKeyValueEditorProps {
  definitions: ResizableKeyValueEditorDefinition[];
  disableKeyInput?: boolean;
  disableDeleteDefinition?: boolean;
  disableValueInput?: boolean;
  disableNewDefinition?: boolean;
  disableHeader?: boolean;
  width?: number;

  setDefinitions: Dispatch<SetStateAction<ResizableKeyValueEditorDefinition[]>>;
  actions?: React.ReactNode;
}

export function ResizableKeyValueEditor(props: ResizableKeyValueEditorProps) {
  const {
    definitions,
    disableDeleteDefinition,
    disableNewDefinition,
    disableKeyInput,
    disableHeader,
    disableValueInput,
    width: initialWidth,
    setDefinitions,
    actions,
  } = props;

  const handleValueChange = useCallback(
    (index: number, newValue: string) => {
      setDefinitions((prev) => {
        return prev.map((definition, i) => {
          if (i === index) {
            return {
              ...definition,
              value: newValue,
            };
          } else {
            return definition;
          }
        });
      });
    },
    [setDefinitions],
  );

  const handleAddDefinition = useCallback(() => {
    setDefinitions((prev) => {
      return [
        ...prev,
        {
          key: '',
          value: '',
          scope: 'agent',
          overriddenValues: [],
        },
      ];
    });
  }, [setDefinitions]);

  const handleDeleteDefinition = useCallback(
    (index: number) => {
      setDefinitions((prev) => {
        return prev.filter((_, i) => i !== index);
      });
    },
    [setDefinitions],
  );

  const handleKeyChange = useCallback(
    (index: number, newKey: string) => {
      setDefinitions((prev) => {
        return prev.map((definition, i) => {
          if (i === index) {
            return {
              ...definition,
              key: newKey,
            };
          } else {
            return definition;
          }
        });
      });
    },
    [setDefinitions],
  );

  const t = useTranslations('components/ResizableKeyValueEditor');

  const [width, setWidth] = useState(initialWidth || 40);

  const container = useRef<HTMLDivElement>(null);
  const draggingHandle = useRef<HTMLDivElement>(null);

  const isDragging = useRef(false);

  useEffect(() => {
    const currentContainer = draggingHandle.current;

    function handleMouseMove(e: MouseEvent) {
      if (isDragging.current && container.current) {
        const rect = container.current.getBoundingClientRect();
        const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
        setWidth(newWidth);
      }
    }

    function handleMouseUp() {
      isDragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    function handleMouseDown() {
      isDragging.current = true;
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    if (currentContainer) {
      currentContainer.addEventListener('mousedown', handleMouseDown);
    }

    return () => {
      if (currentContainer) {
        currentContainer.removeEventListener('mousedown', handleMouseDown);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [container]);

  return (
    <VStack
      ref={container}
      fullWidth
      fullHeight
      gap={false}
      position="relative"
    >
      <div className="pointer-events-none absolute z-[1] flex  top-0 left-0 w-full h-full">
        <div style={{ width: `${width}%` }} className="h-full  " />
        <div
          ref={draggingHandle}
          className="cursor-col-resize h-full  pointer-events-auto w-[5px]"
        >
          <div className="w-[2px] h-full bg-background-grey2 " />
        </div>
      </div>
      {!disableHeader && (
        <Row
          keyCell={<TitleCell>{t('key')}</TitleCell>}
          valueCell={<TitleCell>{t('value')}</TitleCell>}
          width={width}
        />
      )}
      {definitions.map((definition, index) => (
        <DefinitionRow
          key={index}
          definition={definition}
          disableValueInput={disableValueInput}
          index={index}
          width={width}
          handleDeleteDefinition={handleDeleteDefinition}
          handleValueChange={handleValueChange}
          handleKeyChange={handleKeyChange}
          disableKeyInput={disableKeyInput}
          disableDeleteDefinition={disableDeleteDefinition}
        />
      ))}
      {!disableNewDefinition && (
        <HStack
          gap={false}
          align="center"
          padding="small"
          justify="spaceBetween"
        >
          <div className="overflow-hidden" style={{ width: `${width}%` }}>
            <HStack>{actions}</HStack>
          </div>
          <Tooltip content={t('addDefinition')}>
            <Button
              preIcon={<PlusIcon />}
              label={t('addDefinition')}
              onClick={handleAddDefinition}
              color="secondary"
              size="xsmall"
              hideLabel
              _use_rarely_className="p-[3px]"
            ></Button>
          </Tooltip>
        </HStack>
      )}
    </VStack>
  );
}
