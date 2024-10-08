import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../core/DropdownMenu/DropdownMenu';
import { Slot } from '@radix-ui/react-slot';

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
    <DropdownMenu>
      <DropdownMenuTrigger>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent className="p-0 border-none rounded-none bg-background-black text-background-black-content">
        {items.map((item, index) => (
          <DropdownMenuItem
            className="hover:bg-background-black-hover focus:bg-background-black-hover"
            key={index}
            onClick={item.onClick}
          >
            <Slot className="w-3">{item.icon}</Slot>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
