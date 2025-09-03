import React from 'react';
import {
  HStack,
  RawInput,
  SearchIcon,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from 'next-intl';

interface SearchToolsProps {
  search: string;
  setSearch: (search: string) => void;
}

export function SearchTools(props: SearchToolsProps) {
  const { search, setSearch } = props;
  const t = useTranslations('SearchTools');

  return (
    <HStack color="background-grey">
      <RawInput
        preIcon={<SearchIcon />}
        placeholder={t('placeholder')}
        label={t('label')}
        hideLabel
        fullWidth
        color="transparent"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
        }}
      />
    </HStack>
  );
}
