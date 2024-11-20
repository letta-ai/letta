import * as React from 'react';
import type { PropsWithChildren } from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import { RawInput } from '../../core/Input/Input';
import { SearchIcon } from '../../icons';
import { Frame } from '../../framing/Frame/Frame';

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
    description?: string;
  }
>;

export function DashboardPageSection(props: DashboardPageSectionProps) {
  const {
    children,
    actions,
    fullHeight,
    title,
    description,
    borderBottom,
    searchPlaceholder,
    searchValue,
    onSearch,
  } = props;

  return (
    <VStack
      paddingX="large"
      paddingTop="medium"
      paddingBottom="small"
      fullHeight={fullHeight}
      flex={fullHeight}
      fullWidth
      borderBottom={borderBottom}
    >
      {title && (
        <HStack align="center" justify="spaceBetween">
          <Typography align="left" noWrap bold variant="heading3">
            {title}
          </Typography>
          <HStack>{actions}</HStack>
        </HStack>
      )}
      {description && (
        <Typography align="left" variant="body">
          {description}
        </Typography>
      )}
      {onSearch && (
        <Frame paddingTop>
          <DashboardSearchBar
            searchPlaceholder={searchPlaceholder || ''}
            searchValue={searchValue || ''}
            onSearch={onSearch}
          />
        </Frame>
      )}

      {children}
    </VStack>
  );
}
