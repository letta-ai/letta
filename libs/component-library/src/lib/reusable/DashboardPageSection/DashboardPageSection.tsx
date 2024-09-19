import * as React from 'react';
import type { PropsWithChildren } from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import { RawInput } from '../../core/Input/Input';
import { SearchIcon } from 'lucide-react';

interface DashboardSearchBarProps {
  onSearch: (searchTerm: string) => void;
  searchPlaceholder: string;
  searchValue: string;
}

function DashboardSearchBar(props: DashboardSearchBarProps) {
  const { onSearch, searchPlaceholder, searchValue } = props;
  return (
    <HStack>
      <RawInput
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

type DashboardPageSectionProps = PropsWithChildren<
  Partial<DashboardSearchBarProps> & {
    actions?: React.ReactNode;

    fullHeight?: boolean;
    borderBottom?: boolean;
    title?: string;
  }
>;

export function DashboardPageSection(props: DashboardPageSectionProps) {
  const {
    children,
    actions,
    fullHeight,
    title,
    borderBottom,
    searchPlaceholder,
    searchValue,
    onSearch,
  } = props;

  return (
    <VStack
      paddingX="large"
      paddingY="medium"
      fullHeight={fullHeight}
      fullWidth
      borderBottom={borderBottom}
    >
      {title && (
        <HStack align="center" justify="spaceBetween">
          <Typography noWrap bold variant="heading2">
            {title}
          </Typography>
          <HStack>{actions}</HStack>
        </HStack>
      )}
      {onSearch && (
        <DashboardSearchBar
          searchPlaceholder={searchPlaceholder || ''}
          searchValue={searchValue || ''}
          onSearch={onSearch}
        />
      )}

      {children}
    </VStack>
  );
}
