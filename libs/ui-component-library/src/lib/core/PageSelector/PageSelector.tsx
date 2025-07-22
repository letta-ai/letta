import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { Button } from '../Button/Button';
import { ChevronRightIcon } from '../../icons';
import { useTranslations } from '@letta-cloud/translations';
import { useMemo } from 'react';
import { getPageNumbersToShow } from './getPageNumbersToShow';

interface PageSelectorProps {
  visiblePageCount?: number;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function PageSelector(props: PageSelectorProps) {
  const t = useTranslations('components/PageSelector');
  const { visiblePageCount = 5, totalPages, currentPage, onPageChange } = props;

  const pageNumbersToShow = useMemo(() => {
    return getPageNumbersToShow(currentPage, totalPages, visiblePageCount);
  }, [currentPage, totalPages, visiblePageCount]);

  return (
    <HStack>
      <Button
        hideLabel
        color="tertiary"
        label={t('loadPreviousPage')}
        preIcon={<ChevronRightIcon className="rotate-180" />}
        disabled={currentPage <= 1}
        onClick={() => {
          onPageChange(currentPage - 1);
        }}
      />
      {pageNumbersToShow.map((num) => {
        return (
          <Button
            key={num}
            color={num === currentPage ? 'secondary' : 'tertiary'}
            label={String(num)}
            onClick={() => {
              onPageChange(num);
            }}
          />
        );
      })}
      <Button
        hideLabel
        color="tertiary"
        label={t('loadNextPage')}
        preIcon={<ChevronRightIcon />}
        disabled={currentPage >= totalPages}
        onClick={() => {
          onPageChange(currentPage + 1);
        }}
      />
    </HStack>
  );
}
