import * as React from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { Typography } from '../../core/Typography/Typography';
import { HStack } from '../../framing/HStack/HStack';
import { Button } from '../../core/Button/Button';
import { SearchIcon } from '../../icons';
import { useTranslations } from '@letta-cloud/translations';

interface QueryBuilderWrapperProps {
  label: string;
  searchText?: string;
  children: React.ReactNode;
  isLoading?: boolean;
}

export function QueryBuilderWrapper(props: QueryBuilderWrapperProps) {
  const { label, isLoading, searchText, children } = props;
  const t = useTranslations('components/QueryBuilderWrapper');
  return (
    <VStack gap={false}>
      <VStack paddingY="xxsmall">
        <Typography bold variant="body2" color="lighter">
          {label}
        </Typography>
      </VStack>
      <VStack gap={false} border padding={'small'} color={'background-grey'}>
        <VStack>{children}</VStack>
        <HStack
          className="mt-[-30px] pointer-events-none"
          fullWidth
          align="center"
          justify="end"
        >
          <HStack className="pointer-events-auto" align="center" justify="end">
            <Button
              type="submit"
              busy={isLoading}
              preIcon={<SearchIcon />}
              label={searchText || t('search')}
              color="secondary"
            />
          </HStack>
        </HStack>
      </VStack>
    </VStack>
  );
}
