'use client';
import React, { useMemo } from 'react';
import type { CodeProps } from '@letta-web/component-library';
import { LettaLoader } from '@letta-web/component-library';
import { RawSwitch } from '@letta-web/component-library';
import { Code } from '@letta-web/component-library';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useGlobalSessionSettings } from '$letta/client/hooks/session';

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
        <>
          {isLoading && showAPIKeysInCode && <LettaLoader size="small" />}
          <RawSwitch
            data-testid="show-api-key-switch"
            label="Show API Key"
            checked={showAPIKeysInCode}
            onClick={() => {
              setShowAPIKeysInCode((v) => !v);
            }}
          />
          {props.toolbarAction}
        </>
      }
      code={codeWithAPIKey}
    />
  );
}
