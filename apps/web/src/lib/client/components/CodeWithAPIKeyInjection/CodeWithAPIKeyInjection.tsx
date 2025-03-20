'use client';
import React, { useMemo } from 'react';
import { type CodeProps, HStack } from '@letta-cloud/ui-component-library';
import { LettaLoader } from '@letta-cloud/ui-component-library';
import { RawSwitch } from '@letta-cloud/ui-component-library';
import { Code } from '@letta-cloud/ui-component-library';
import { webApi, webApiQueryKeys } from '$web/client';
import { useGlobalSessionSettings } from '$web/client/hooks/session';

type CodeWithAPIKeyInjectionProps = CodeProps;

export const ACCESS_TOKEN_PLACEHOLDER = 'YOUR_API_KEY';

export function CodeWithAPIKeyInjection(props: CodeWithAPIKeyInjectionProps) {
  const { setShowAPIKeysInCode, showAPIKeysInCode } =
    useGlobalSessionSettings();
  const { data, isLoading } = webApi.apiKeys.getAPIKey.useQuery({
    queryKey: webApiQueryKeys.apiKeys.getApiKey('first'),
    queryData: {
      params: {
        apiKeyId: 'first',
      },
    },
  });

  const codeWithAPIKey = useMemo(() => {
    if (!data || !showAPIKeysInCode) {
      return props.code;
    }

    return props.code.replace(ACCESS_TOKEN_PLACEHOLDER, data.body.apiKey);
  }, [data, props.code, showAPIKeysInCode]);

  return (
    <Code
      {...props}
      toolbarAction={
        <HStack paddingTop="xsmall" align="center">
          {isLoading && showAPIKeysInCode && <LettaLoader size="small" />}
          <RawSwitch
            labelVariant="simple"
            data-testid="show-api-key-switch"
            label="Show API Key"
            checked={showAPIKeysInCode}
            onClick={() => {
              setShowAPIKeysInCode((v) => !v);
            }}
          />
          {props.toolbarAction}
        </HStack>
      }
      code={codeWithAPIKey}
    />
  );
}
