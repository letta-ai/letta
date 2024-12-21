import * as React from 'react';
import type { PropsWithChildren } from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import { RawInput } from '../../core/Input/Input';
import { SearchIcon } from '../../icons';
import { Frame } from '../../framing/Frame/Frame';
import { HiddenOnMobile } from '../../framing/HiddenOnMobile/HiddenOnMobile';
import { VisibleOnMobile } from '../../framing/VisibleOnMobile/VisibleOnMobile';

interface DashboardSearchBarProps {
  onSearch: (searchTerm: string) => void;
  searchPlaceholder: string;
  searchValue: string;
}

function SectionSearchBar(props: DashboardSearchBarProps) {
  const { onSearch, searchPlaceholder, searchValue } = props;
  return (
    <HStack>
      <RawInput
        preIcon={<SearchIcon />}
        hideLabel
        color="grey"
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

type SectionProps = PropsWithChildren<
  Partial<DashboardSearchBarProps> & {
    actions?: React.ReactNode;
    fullHeight?: boolean;
    borderBottom?: boolean;
    title?: string;
    description?: string;
  }
>;

export function Section(props: SectionProps) {
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
      paddingBottom="small"
      fullHeight={fullHeight}
      flex={fullHeight}
      fullWidth
      borderBottom={borderBottom}
    >
      <VStack gap={false}>
        {title && (
          <HStack align="center" justify="spaceBetween">
            <Typography align="left" noWrap bold variant="body">
              {title}
            </Typography>
            <HiddenOnMobile>
              <HStack>{actions}</HStack>
            </HiddenOnMobile>
          </HStack>
        )}
        {description && (
          <Typography align="left" color="lighter" variant="body">
            {description}
          </Typography>
        )}
      </VStack>
      {onSearch && (
        <Frame>
          <SectionSearchBar
            searchPlaceholder={searchPlaceholder || ''}
            searchValue={searchValue || ''}
            onSearch={onSearch}
          />
        </Frame>
      )}
      {actions && (
        <VisibleOnMobile>
          <HStack>{actions}</HStack>
        </VisibleOnMobile>
      )}
      {children}
    </VStack>
  );
}
