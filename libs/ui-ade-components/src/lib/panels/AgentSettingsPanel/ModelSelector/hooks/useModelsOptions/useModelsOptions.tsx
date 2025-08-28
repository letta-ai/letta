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
import { useTranslations } from '@letta-cloud/translations';

function useLocalModelsOptions() {
  const { data: modelsList } = useModelsServiceListModels();

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

function useHostedOptions() {
  const { data: modelsList } = useModelsServiceListModels();

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

    modelsList.forEach((model) => {
      let brand = model?.provider_name || 'ollama';

      if (brand === 'anthropic') {
        brand = 'claude';
      }

      const badge = (() => {
        if (model.provider_category === 'byok') {
          return null;
        }

        if (model.tier === 'free') {
          return (
            <Badge
              size="small"
              variant="chipStandard"
              border={true}
              content={t('standard.label')}
            />
          );
        }

        if (model.tier === 'premium') {
          return (
            <Badge
              size="small"
              variant="chipPremium"
              border={true}
              content={t('premium.label')}
            />
          );
        }

        return (
          <Badge
            size="small"
            variant="chipUsageBased"
            border={true}
            content={t('usageBased.label')}
          />
        );
      })();

      const option = {
        label:
          model.provider_category === 'byok'
            ? model.handle || model.model
            : model.model || '',
        value: model.handle || '',
        group: model.provider_category,
        badge: badge,
        icon: isBrandKey(brand) ? brandKeyToLogo(brand) : '',
      };

      if (model.provider_category === 'byok') {
        options[1].options!.push(option);
      }

      if (model.provider_category === 'base') {
        options[0].options!.push(option);
      }
    });

    return options.filter(
      (option) => option.options && option.options.length > 0,
    );
  }, [modelsList, t]);

  const getLLMConfigFromHandle = useCallback(
    (handle: string) => {
      return modelsList?.find((model) => model.handle === handle);
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

  const localOptions = useLocalModelsOptions();
  const hostedOptions = useHostedOptions();

  return useMemo(() => {
    if (isLocal) {
      return localOptions;
    }

    return hostedOptions;
  }, [localOptions, hostedOptions, isLocal]);
}
