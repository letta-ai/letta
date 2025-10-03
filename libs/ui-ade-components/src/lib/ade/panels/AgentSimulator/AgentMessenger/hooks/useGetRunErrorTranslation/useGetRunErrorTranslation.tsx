import React, { useCallback, useMemo } from 'react';
import { Link } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCurrentAgentMetaData } from '@letta-cloud/ui-ade-components';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';


function useBillingTier() {
  const { isLocal } = useCurrentAgentMetaData();

  const { data } =
    webApi.organizations.getCurrentOrganizationBillingInfo.useQuery({
      queryKey: webApiQueryKeys.organizations.getCurrentOrganizationBillingInfo,
      enabled: !isLocal,
    });

  return useMemo(() => {
    return data?.body.billingTier || 'enterprise';
  }, [data?.body.billingTier]);
}

export function useGetRunErrorTranslation() {
  const t = useTranslations('ADE/AgentSimulator');
  const billingTier = useBillingTier();
  const { isLocal } = useCurrentAgentMetaData();

  return useCallback((errorCode: string) => {
    switch (errorCode) {
      case 'CONTEXT_WINDOW_EXCEEDED':
        return t('hasFailedToSendMessageText.contextWindowExceeded');
      case 'RATE_LIMIT_EXCEEDED':
        return t('hasFailedToSendMessageText.rateLimitExceeded');
      case 'AGENT_LIMIT_EXCEEDED':
        switch (billingTier) {
          case 'enterprise':
            return t(
              'hasFailedToSendMessageText.agentLimitExceeded.enterprise',
            );
          case 'pro-legacy':
            return t.rich('hasFailedToSendMessageText.agentLimitExceeded.pro', {
              link: (chunks) => {
                return (
                  <Link target="_blank" href="/settings/organization/usage">
                    {chunks}
                  </Link>
                );
              },
            });
          case 'scale':
            return t('hasFailedToSendMessageText.agentLimitExceeded.scale');
          default:
            return t.rich(
              'hasFailedToSendMessageText.agentLimitExceeded.free',
              {
                link: (chunks) => {
                  return (
                    <Link target="_blank" href="/settings/organization/usage">
                      {chunks}
                    </Link>
                  );
                },
              },
            );
        }
      case 'FREE_USAGE_EXCEEDED':
        if (billingTier === 'enterprise') {
          return t('hasFailedToSendMessageText.freeUsageExceeded.enterprise');
        }
        if (billingTier === 'pro-legacy') {
          return t.rich('hasFailedToSendMessageText.freeUsageExceeded.pro', {
            link: (chunks) => {
              return (
                <Link target="_blank" href="/settings/organization/usage">
                  {chunks}
                </Link>
              );
            },
          });
        }

        if (billingTier === 'scale') {
          return t('hasFailedToSendMessageText.freeUsageExceeded.scale');
        }

        return t.rich('hasFailedToSendMessageText.freeUsageExceeded.free', {
          link: (chunks) => {
            return (
              <Link target="_blank" href="/settings/organization/usage">
                {chunks}
              </Link>
            );
          },
        });
      case 'PREMIUM_USAGE_EXCEEDED':
        if (billingTier === 'enterprise') {
          return t(
            'hasFailedToSendMessageText.premiumUsageExceeded.enterprise',
          );
        }

        if (billingTier === 'scale') {
          return t('hasFailedToSendMessageText.premiumUsageExceeded.scale');
        }

        if (billingTier === 'pro-legacy') {
          return t.rich('hasFailedToSendMessageText.premiumUsageExceeded.pro', {
            link: (chunks) => {
              return (
                <Link target="_blank" href="/settings/organization/usage">
                  {chunks}
                </Link>
              );
            },
          });
        }

        return t.rich('hasFailedToSendMessageText.premiumUsageExceeded.free', {
          link: (chunks) => {
            return (
              <Link target="_blank" href="/settings/organization/usage">
                {chunks}
              </Link>
            );
          },
        });
      case 'CREDIT_LIMIT_EXCEEDED':
        return t.rich('hasFailedToSendMessageText.creditLimitExceeded', {
          link: (chunks) => {
            return (
              <Link target="_blank" href="/settings/organization/usage">
                {chunks}
              </Link>
            );
          },
        });
      case 'INTERNAL_SERVER_ERROR':
      default:
        if (isLocal) {
          return t('hasFailedToSendMessageText.local');
        }
        return t('hasFailedToSendMessageText.cloud');
    }
  }, [billingTier, isLocal, t]);
}
