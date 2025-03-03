import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuItem,
} from '../../core/DropdownMenu/DropdownMenu';

interface ADEDropdownMenuItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

export interface ADEDropdownMenuProps {
  items: ADEDropdownMenuItem[];
  trigger: React.ReactNode;
}

export function ADEDropdownMenu(props: ADEDropdownMenuProps) {
  const { items, trigger } = props;

  return (
    <DropdownMenu
      className="p-0 border-none rounded-none bg-background-black text-background-black-content"
      trigger={trigger}
    >
      {items.map((item, index) => (
        <DropdownMenuItem
          className="hover:bg-background-black-hover focus:bg-background-black-hover"
          key={index}
          onClick={item.onClick}
          preIcon={item.icon}
          label={item.label}
        ></DropdownMenuItem>
      ))}
    </DropdownMenu>
  );
}
