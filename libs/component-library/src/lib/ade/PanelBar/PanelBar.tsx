import type { PropsWithChildren } from 'react';
import { type ChangeEvent, useCallback } from 'react';
import * as React from 'react';
import { ChevronLeftIcon, SearchIcon } from '../../icons';
import { Button } from '../../core/Button/Button';
import { HStack } from '../../framing/HStack/HStack';
import { RawInput } from '../../core/Input/Input';

interface PanelSearchProps {
  placeholder: string;
  onChange: (value: string) => void;
  value: string;
}

function PanelSearch(props: PanelSearchProps) {
  const { placeholder, value, onChange } = props;

  const handleChange = useCallback(
    function handleChange(event: ChangeEvent<HTMLInputElement>) {
      onChange(event.target.value);
    },
    [onChange]
  );

  return (
    <HStack align="center" paddingLeft="medium" fullWidth>
      <RawInput
        label="search"
        hideLabel
        fullWidth
        preIcon={<SearchIcon />}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
      />
    </HStack>
  );
}

type PanelBarProps = PropsWithChildren<{
  actions?: React.ReactNode;
  showReturn?: boolean;
  onReturn?: () => void;
  onSearch?: (value: string) => void;
  searchValue?: string;
}>;

export function PanelBar(props: PanelBarProps) {
  const { onReturn } = props;
  return (
    <div className="pt-2 flex w-full items-center justify-between flex-row">
      {onReturn && (
        <Button
          label="Return"
          color="tertiary"
          size="small"
          type="button"
          preIcon={<ChevronLeftIcon />}
          onClick={onReturn}
          variant="inline-panel"
        ></Button>
      )}
      <div className="w-full flex-row flex items-center gap-2">
        {props.onSearch && (
          <PanelSearch
            placeholder="Search"
            value={props.searchValue || ''}
            onChange={props.onSearch}
          />
        )}
        {props.children}
      </div>
      {props.actions && (
        <div className="px-2 flex flex-row gap-2">{props.actions}</div>
      )}
    </div>
  );
}
