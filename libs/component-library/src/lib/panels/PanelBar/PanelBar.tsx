import type { PropsWithChildren } from 'react';
import { type ChangeEvent, useCallback } from 'react';
import * as React from 'react';

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
    <div className="flex flex-row w-full items-center space-between px-3 h-[42px]">
      <input
        type="text"
        placeholder={placeholder}
        className="w-full bg-transparent border-none text-base outline-none"
        value={value}
        onChange={handleChange}
      />
    </div>
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
    <div className="flex items-center border-b justify-between w-full flex-row h-[42px] gap-3">
      {onReturn && (
        <button
          onClick={onReturn}
          className="h-full px-3 text-base bg-background-grey border-r"
        >
          Return
        </button>
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
