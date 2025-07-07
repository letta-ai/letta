import { useObservabilityContext } from '$web/client/hooks/useObservabilityContext/useObservabilityContext';
import type { AgentTemplateType } from '@letta-cloud/sdk-web';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import {
  Button,
  isMultiValue,
  Popover,
  RawAsyncSelect,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useEmptyBaseTemplateValue } from '../../hooks/useEmptyBaseTemplateValue/useEmptyBaseTemplateValue';

function TemplateSelectorDropdown() {
  const { setBaseTemplateId, baseTemplateId } = useObservabilityContext();

  const { data } = webApi.agentTemplates.listAgentTemplates.useQuery({
    queryKey: webApiQueryKeys.agentTemplates.listAgentTemplates,
  });

  const t = useTranslations(
    'pages/projects/observability/AdvancedObservabilityFilter',
  );

  const emptyValue = useEmptyBaseTemplateValue();

  const formatOptions = useCallback(
    (options: AgentTemplateType[]) => {
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
      const response = await webApi.agentTemplates.listAgentTemplates.query({
        query: {
          search: inputValue,
        },
      });

      if (response.status !== 200) {
        return [];
      }

      return formatOptions(response.body.agentTemplates);
    },
    [formatOptions],
  );

  return (
    <RawAsyncSelect
      fullWidth
      label={t('TemplateSelectorDropdown.title')}
      defaultOptions={data ? formatOptions(data.body.agentTemplates) : []}
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
