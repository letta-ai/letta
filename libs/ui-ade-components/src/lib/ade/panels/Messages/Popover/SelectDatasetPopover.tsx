import React, { useCallback, useState } from 'react';
import {
  Button,
  HStack,
  Popover,
  RawCheckbox,
  RawInput,
  SaveIcon,
  SearchIcon,
  Typography,
  VStack,
  toast,
} from '@letta-cloud/ui-component-library';
import { useDebouncedValue } from '@mantine/hooks';
import { useTranslations } from '@letta-cloud/translations';
import { useDatasets } from '../../../../hooks/useDatasets/useDatasets';
import type { AgentSimulatorMessageType } from '../../AgentSimulator/types';

interface SelectDatasetPopoverProps {
  message: AgentSimulatorMessageType;
  projectId?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SelectDatasetPopover({
  message,
  projectId,
  isOpen,
  onOpenChange,
}: SelectDatasetPopoverProps) {
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 300);
  const t = useTranslations('components/Messages');

  const {
    datasets,
    isLoading: isDatasetsLoading,
    createDatasetItem,
    createDatasetItemError,
  } = useDatasets({
    projectId,
    limit: 10,
    search: debouncedSearchTerm.trim() || undefined,
  });

  const handlePopoverClose = useCallback(() => {
    onOpenChange(false);
    setSelectedDatasets([]); // Reset selections when closing
    setSearchTerm(''); // Reset search when closing
  }, [onOpenChange]);

  const handleSaveToDatasets = useCallback(() => {
    const newDatasetItemPrompt = {
      role: message.name || '',
      content: message.raw || '',
    };

    selectedDatasets.forEach((datasetId) => {
      createDatasetItem({ datasetId, content: newDatasetItemPrompt });
    });

    const datasetNames = selectedDatasets.map(
      (id) => datasets.find((d) => d.id === id)?.name || '',
    );
    const toastMessage = t('savedPromptToDatasets', {
      datasetNames: datasetNames.join(', '),
    });
    if (selectedDatasets.length > 0 && !createDatasetItemError) {
      toast.success(toastMessage);
    } else {
      toast.error(
        t('savedPromptToDatasetsError', {
          datasetNames: datasetNames.join(', '),
        }),
      );
    }

    handlePopoverClose();
  }, [
    selectedDatasets,
    handlePopoverClose,
    createDatasetItem,
    createDatasetItemError,
    message,
    datasets,
    t,
  ]);

  return (
    <Popover
      triggerAsChild
      align="end"
      open={isOpen}
      onOpenChange={onOpenChange}
      trigger={
        <Button
          label={t('saveToDataset')}
          size="3xsmall"
          preIcon={<SaveIcon color="muted" size="auto" />}
          hideLabel
          square
          color="tertiary"
          _use_rarely_className="w-4 h-4 messages-step-editor"
        />
      }
    >
      <VStack gap="medium" className="p-4 min-w-[200px]">
        <Typography variant="body2" className="font-semibold">
          {t('saveToDataset')}
        </Typography>
        <Typography variant="body3" className="text-muted">
          {t('selectDatasetPrompt')}
        </Typography>
        <RawInput
          label={t('searchDatasets')}
          hideLabel
          fullWidth
          placeholder={t('searchDatasetsPlaceholder')}
          preIcon={<SearchIcon />}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
          }}
        />
        {isDatasetsLoading ||
        (searchTerm && searchTerm !== debouncedSearchTerm) ? (
          <Typography variant="body3">
            {searchTerm && searchTerm !== debouncedSearchTerm
              ? t('searching')
              : t('loadingDatasets')}
          </Typography>
        ) : datasets.length === 0 ? (
          <Typography variant="body3">
            {debouncedSearchTerm
              ? t('noDatasetsFound')
              : t('noDatasetsAvailable')}
          </Typography>
        ) : (
          <VStack gap="small" className="max-h-48 overflow-y-auto">
            {datasets.map((dataset) => (
              <RawCheckbox
                key={dataset.id}
                label={dataset.name}
                checked={selectedDatasets.includes(dataset.id)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedDatasets((prev) => [...prev, dataset.id]);
                  } else {
                    setSelectedDatasets((prev) =>
                      prev.filter((id) => id !== dataset.id),
                    );
                  }
                }}
              />
            ))}
          </VStack>
        )}
        <HStack gap="small" justify="end">
          <Button
            size="small"
            color="tertiary"
            label={t('cancel')}
            onClick={handlePopoverClose}
          />
          <Button
            size="small"
            color="primary"
            label={t('save')}
            disabled={selectedDatasets.length === 0}
            onClick={handleSaveToDatasets}
          />
        </HStack>
      </VStack>
    </Popover>
  );
}
