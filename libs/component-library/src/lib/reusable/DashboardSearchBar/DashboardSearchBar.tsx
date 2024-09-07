import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { RawInput } from '../../core/Input/Input';
import { SearchIcon } from 'lucide-react';

interface DashboardSearchBarProps {
  onSearch: (searchTerm: string) => void;
  searchPlaceholder: string;
  searchValue: string;
}

export function DashboardSearchBar(props: DashboardSearchBarProps) {
  const { onSearch, searchPlaceholder, searchValue } = props;
  return (
    <HStack>
      <RawInput
        className="w-[250px]"
        preIcon={<SearchIcon />}
        hideLabel
        role="search"
        label="Search"
        fullWidth
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={(e) => {
          onSearch(e.target.value);
        }}
      />
    </HStack>
  );
}
