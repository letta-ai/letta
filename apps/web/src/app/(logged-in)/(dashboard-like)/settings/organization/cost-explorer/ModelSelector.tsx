import React, { useMemo } from 'react';
import {
  ExtendedLLMSchema,
  webOriginSDKApi,
  webOriginSDKQueryKeys,
} from '@letta-cloud/letta-agents-api';
import { useTranslations } from '@letta-cloud/translations';
import { getBrandFromModelName } from '@letta-cloud/generic-utils';
import {
  Badge,
  brandKeyToLogo,
  isBrandKey,
  isMultiValue,
  RawSelect,
} from '@letta-cloud/component-library';
interface ModelSelectorProps {
  currentModelId: string;
  onSelectModelId: (modelId: string) => void;
}

export function useListLLMBackends() {
  return webOriginSDKApi.models.listLLMBackends.useQuery({
    queryKey: webOriginSDKQueryKeys.models.listEmbeddingBackendsWithSearch({
      extended: true,
    }),
    queryData: {
      query: {
        extended: true,
      },
    },
  });
}

export function ModelSelector(props: ModelSelectorProps) {
  const { onSelectModelId, currentModelId } = props;
  const t = useTranslations('ADE/AgentSettingsPanel');

  const { data: modelsList, isLoading } = useListLLMBackends();

  const formattedModelsList = useMemo(() => {
    if (!modelsList) {
      return [];
    }

    return modelsList.body
      .map((value) => {
        const { model, handle } = value;
        let modelName = handle || model;
        let brand = 'llama';
        let isRecommended = false;
        let badge = '';
        let id = '';

        if (ExtendedLLMSchema.safeParse(value).success) {
          const out = ExtendedLLMSchema.safeParse(value).data;

          id = out?.id || id;
          brand = out?.brand || brand;
          isRecommended = out?.isRecommended || isRecommended;
          badge = out?.tag || badge;
          modelName = out?.displayName || modelName;
        }

        if (brand === 'llama') {
          brand = getBrandFromModelName(model) || brand;
        }

        return {
          icon: isBrandKey(brand) ? brandKeyToLogo(brand) : '',
          label: modelName,
          value: id,
          brand,
          isRecommended,
          badge: badge ? <Badge size="small" content={badge} /> : '',
        };
      })
      .sort(function (a, b) {
        if (a.brand < b.brand) {
          return -1;
        }
        if (a.brand > b.brand) {
          return 1;
        }
        return 0;
      });
  }, [modelsList]);

  const value = useMemo(() => {
    return formattedModelsList.find((model) => model.value === currentModelId);
  }, [formattedModelsList, currentModelId]);

  return (
    <RawSelect
      fullWidth
      isLoading={isLoading}
      onSelect={(value) => {
        if (isMultiValue(value)) {
          return;
        }

        if (!value?.value) {
          return;
        }
        onSelectModelId(value.value);
      }}
      value={value}
      label={t('modelInput.label')}
      options={formattedModelsList}
    />
  );
}
