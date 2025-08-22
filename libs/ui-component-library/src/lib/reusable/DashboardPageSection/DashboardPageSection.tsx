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
import { cn } from '@letta-cloud/ui-styles';

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
    width?: 'capped' | 'full';
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
    width,
    searchValue,
    onSearch,
  } = props;

  return (
    <VStack
      gap="large"
      paddingX="small"
      paddingTop="xsmall"
      paddingBottom="large"
      fullHeight={fullHeight}
      flex={fullHeight}
      fullWidth
      className={cn(width === 'capped' ? 'max-w-[824px]' : 'w-full')}
      borderBottom={borderBottom}
    >
      {!title && !description ? null : (
        <VStack gap={false}>
          {title && (
            <HStack align="center" justify="spaceBetween">
              <Typography align="left" noWrap bold variant="heading4">
                {title}
              </Typography>
              <HiddenOnMobile>
                <HStack>{actions}</HStack>
              </HiddenOnMobile>
            </HStack>
          )}
          {description && (
            <Typography align="left" variant="body" color="lighter">
              {description}
            </Typography>
          )}
        </VStack>
      )}
      {onSearch && (
        <Frame>
          <DashboardSearchBar
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
