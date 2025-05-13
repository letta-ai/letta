import React, { useCallback, useMemo } from 'react';
import { getBrandFromModelName } from '@letta-cloud/utils-shared';
import type { OptionType } from '@letta-cloud/ui-component-library';
import { Button, TokenIcon } from '@letta-cloud/ui-component-library';
import {
  Badge,
  brandKeyToLogo,
  isBrandKey,
} from '@letta-cloud/ui-component-library';
import { useModelsServiceListModels } from '@letta-cloud/sdk-core';
import { useFeatureFlag, webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useTranslations } from '@letta-cloud/translations';

function useLocalModelsOptions(enabled: boolean) {
  const { data: modelsList } = useModelsServiceListModels(
    undefined,
    undefined,
    {
      enabled,
    },
  );

  const options = useMemo(() => {
    if (!modelsList) {
      return [];
    }

    return modelsList.map((model) => {
      const brand = getBrandFromModelName(model.handle || '') || 'ollama';

      return {
        label: model.handle || '',
        value: model.handle || '',
        icon: isBrandKey(brand) ? brandKeyToLogo(brand) : '',
      };
    });
  }, [modelsList]);

  const getLLMConfigFromHandle = useCallback(
    (handle: string) => {
      return modelsList?.find((model) => model.handle === handle);
    },
    [modelsList],
  );

  const getSelectedOption = useCallback(
    (handle: string) => {
      return options.find((option) => option.value === handle);
    },
    [options],
  );

  return {
    options,
    getSelectedOption,
    isLoading: !modelsList,
    getLLMConfigFromHandle,
  };
}

function useHostedOptions(enabled: boolean) {
  const { data: modelsList } = webApi.models.listInferenceModels.useQuery({
    queryKey: webApiQueryKeys.models.listInferenceModels,
    enabled,
  });

  const { data: isProPlan } = useFeatureFlag('PRO_PLAN');
  const t = useTranslations('ADE/AgentSettingsPanel/useHostedOptions');

  const options = useMemo(() => {
    if (!modelsList) {
      return [];
    }

    const options: OptionType[] = [
      {
        label: t('letta'),
        value: 'letta',
        options: [],
      },
      {
        label: t('byok'),
        value: 'byok',
        badge: (
          <Button
            color="tertiary"
            target="_blank"
            href="/models"
            size="xsmall"
            preIcon={<TokenIcon />}
            label={t('viewModels')}
          />
        ),
        options: [],
      },
    ];

    modelsList.body.forEach((model) => {
      const brand = model?.brand || 'ollama';

      const badge = (() => {
        if (!isProPlan) {
          return null;
        }

        if (model.tier === 'free') {
          return (
            <Badge
              size="small"
              variant="success"
              content={t('standard.label')}
            ></Badge>
          );
        }

        if (model.tier === 'premium') {
          return (
            <Badge
              size="small"
              variant="info"
              content={t('premium.label')}
            ></Badge>
          );
        }

        return (
          <Badge
            size="small"
            variant="default"
            content={t('usageBased.label')}
          ></Badge>
        );
      })();

      const option = {
        label: model.displayName || '',
        value: model.handle || '',
        group: model.type,
        badge: badge,
        icon: isBrandKey(brand) ? brandKeyToLogo(brand) : '',
      };

      if (model.type === 'byok') {
        options[1].options!.push(option);
      }

      if (model.type === 'letta') {
        options[0].options!.push(option);
      }
    });

    return options.filter(
      (option) => option.options && option.options.length > 0,
    );
  }, [modelsList, t, isProPlan]);

  const getLLMConfigFromHandle = useCallback(
    (handle: string) => {
      return modelsList?.body.find((model) => model.handle === handle);
    },
    [modelsList],
  );

  const getSelectedOption = useCallback(
    (handle: string) => {
      return options
        .flatMap((option) => option.options)
        .find((option) => option?.value === handle);
    },
    [options],
  );

  return {
    options,
    getSelectedOption,
    isLoading: !modelsList,
    getLLMConfigFromHandle,
  };
}

interface UseModelsOptionsOptions {
  isLocal?: boolean;
}

export function useModelsOptions(options: UseModelsOptionsOptions = {}) {
  const { isLocal } = options;

  const localOptions = useLocalModelsOptions(isLocal || false);
  const hostedOptions = useHostedOptions(!isLocal);

  return useMemo(() => {
    if (isLocal) {
      return localOptions;
    }

    return hostedOptions;
  }, [localOptions, hostedOptions, isLocal]);
}
