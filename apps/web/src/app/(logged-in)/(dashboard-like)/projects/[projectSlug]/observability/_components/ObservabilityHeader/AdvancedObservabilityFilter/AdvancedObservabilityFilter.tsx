import { useObservabilityContext } from '$web/client/hooks/useObservabilityContext/useObservabilityContext';
import { cloudAPI, cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';
import {
  Button,
  isMultiValue,
  Popover,
  RawAsyncSelect,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useEmptyBaseTemplateValue } from '../../hooks/useEmptyBaseTemplateValue/useEmptyBaseTemplateValue';

function TemplateSelectorDropdown() {
  const { setBaseTemplateId, baseTemplateId } = useObservabilityContext();
  const { id: currentProjectId } = useCurrentProject();

  const { data } = cloudAPI.templates.listTemplates.useQuery({
    queryKey: cloudQueryKeys.templates.listTemplatesProjectScopedWithSearch(
      currentProjectId,
      {
        search: '',
        limit: 100,
      },
    ),
    queryData: {
      query: {
        project_id: currentProjectId,
        limit: '100',
      },
    },
  });

  const t = useTranslations(
    'pages/projects/observability/AdvancedObservabilityFilter',
  );

  const emptyValue = useEmptyBaseTemplateValue();

  const formatOptions = useCallback(
    (options: Array<{ id: string; name: string }>) => {
      return [
        ...options.map((a) => ({
          label: a.name,
          value: a.id,
        })),
        emptyValue,
      ];
    },
    [emptyValue],
  );

  const loadOptions = useCallback(
    async (inputValue: string) => {
      const response = await cloudAPI.templates.listTemplates.query({
        query: {
          search: inputValue,
          project_id: currentProjectId,
          limit: '100',
        },
      });

      if (response.status !== 200) {
        return [];
      }

      return formatOptions(response.body.templates);
    },
    [formatOptions, currentProjectId],
  );

  return (
    <RawAsyncSelect
      fullWidth
      label={t('TemplateSelectorDropdown.title')}
      defaultOptions={data ? formatOptions(data.body.templates) : []}
      loadOptions={loadOptions}
      isLoading={!data}
      onSelect={(option) => {
        if (!isMultiValue(option) && option) {
          setBaseTemplateId(option);
        }
      }}
      value={baseTemplateId}
    />
  );
}

export default function AdvancedObservabilityFilter() {
  const t = useTranslations(
    'pages/projects/observability/AdvancedObservabilityFilter',
  );

  const [open, setIsOpen] = useState(false);

  const { baseTemplateId } = useObservabilityContext();

  const count = useMemo(() => {
    let nextCount = 0;

    if (baseTemplateId.value) {
      nextCount += 1;
    }

    return nextCount;
  }, [baseTemplateId]);

  return (
    <Popover
      triggerAsChild
      open={open}
      onOpenChange={setIsOpen}
      trigger={
        <Button
          label={t('TemplateSelectorDropdown.trigger', { count })}
          size="xsmall"
          active={open}
          color="tertiary"
        />
      }
    >
      <VStack fullWidth padding="small">
        <TemplateSelectorDropdown />
      </VStack>
    </Popover>
  );
}
