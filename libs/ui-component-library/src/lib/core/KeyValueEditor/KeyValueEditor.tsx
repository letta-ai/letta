'use client';
import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { CloseIcon, PlusIcon } from '../../icons';
import { Button } from '../Button/Button';
import { useTranslations } from '@letta-cloud/translations';
import { makeInput, makeRawInput } from '../Form/Form';
import { cn } from '@letta-cloud/ui-styles';

export interface KeyValue {
  key: string;
  value: string;
}

interface KeyValueEditorProps {
  value: KeyValue[];
  onValueChange?: (value: KeyValue[]) => void;
  keyPlaceholder?: string;
  addVariableLabel?: string;
  removeVariableLabel?: string;
  fullWidth?: boolean;
  disableKey?: boolean;
  defaultValue?: KeyValue[];
  valuePlaceholder?: string;
  highlightDuplicateKeys?: boolean;
  disabled?: boolean;
  freezeRows?: boolean;
}

function KeyValueEditorPrimitive(props: KeyValueEditorProps) {
  const {
    keyPlaceholder,
    disabled,
    addVariableLabel,
    onValueChange: setValue,
    disableKey,
    value,
    highlightDuplicateKeys,
    fullWidth,
    freezeRows,
    removeVariableLabel,
    valuePlaceholder,
  } = props;

  const keyValuePairs = useMemo(() => {
    return value || [];
  }, [value]);

  const addRow = useCallback(() => {
    if (!setValue) {
      return;
    }

    setValue([...keyValuePairs, { key: '', value: '' }]);
  }, [setValue, keyValuePairs]);

  const updateKey = useCallback(
    (index: number, key: string) => {
      if (!setValue) {
        return;
      }
      setValue(
        keyValuePairs.map((pair, i) => (i === index ? { ...pair, key } : pair)),
      );
    },
    [setValue, keyValuePairs],
  );

  const updateValue = useCallback(
    (index: number, value: string) => {
      if (!setValue) {
        return;
      }
      setValue(
        keyValuePairs.map((pair, i) =>
          i === index ? { ...pair, value } : pair,
        ),
      );
    },
    [setValue, keyValuePairs],
  );

  const removeRow = useCallback(
    (index: number) => {
      if (!setValue) {
        return;
      }
      setValue(keyValuePairs.filter((_pair, i) => i !== index));
    },
    [setValue, keyValuePairs],
  );

  const duplicateKeys = useMemo(() => {
    const keys = keyValuePairs.map((pair) => pair.key);
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
    return new Set(duplicates);
  }, [keyValuePairs]);
  const t = useTranslations('ui-component-library/KeyValueEditor');

  return (
    <VStack fullWidth={fullWidth} gap="small">
      {!disabled && !freezeRows && keyValuePairs.length === 0 && (
        <Button
          onClick={addRow}
          type="button"
          data-testid="add-variable-button"
          color="secondary"
          preIcon={<PlusIcon />}
          label={addVariableLabel || t('addVariable')}
        />
      )}
      {keyValuePairs.map(({ key, value }, index) => {
        const isDuplicateKey = duplicateKeys.has(key) && highlightDuplicateKeys;

        return (
          <HStack key={index} gap="small" fullWidth>
            <HStack
              className={cn(
                isDuplicateKey ? 'border-destructive' : '',
                'min-h-biHeight',
              )}
              fullWidth
              gap={false}
              border
            >
              <input
                className={cn(
                  'text-base min-w-[100px] border-r px-2 bg-transparent disabled:bg-background-grey',
                )}
                type="text"
                value={key}
                data-testid={`key-value-editor-key-${index}`}
                disabled={disabled || disableKey}
                placeholder={keyPlaceholder || 'key'}
                onChange={(e) => {
                  updateKey(index, e.target.value);
                }}
              />
              <input
                type="text"
                data-testid={`key-value-editor-value-${index}`}
                className="text-base w-full min-w-[100px] px-2 bg-transparent disabled:bg-background-grey"
                value={value}
                disabled={disabled}
                placeholder={valuePlaceholder || 'value'}
                onChange={(e) => {
                  updateValue(index, e.target.value);
                }}
              />
            </HStack>
            {!disabled && !freezeRows && (
              <Button
                hideLabel
                color="secondary"
                type="button"
                preIcon={<CloseIcon />}
                onClick={() => {
                  removeRow(index);
                }}
                label={removeVariableLabel || t('removeVariable')}
              />
            )}
            {!disabled && !freezeRows && index === keyValuePairs.length - 1 && (
              <Button
                hideLabel
                color="secondary"
                type="button"
                preIcon={<PlusIcon />}
                onClick={() => {
                  addRow();
                }}
                label={addVariableLabel || t('addVariable')}
              />
            )}
          </HStack>
        );
      })}
    </VStack>
  );
}

export const KeyValueEditor = makeInput(
  KeyValueEditorPrimitive,
  'KeyValueEditor',
);
export const RawKeyValueEditor = makeRawInput(
  KeyValueEditorPrimitive,
  'RawKeyValueEditor',
);
