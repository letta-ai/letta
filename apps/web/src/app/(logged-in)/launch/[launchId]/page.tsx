'use client';
import { useParams } from 'next/navigation';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import {
  Alert,
  Button,
  Form,
  type KeyValue,
  LettaInvaderIcon,
  LoadingEmptyStatusComponent,
  RawInput,
  RocketIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { useCallback, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { capitalize } from 'lodash-es';

function useLaunchId() {
  const params = useParams<{ launchId: string }>();

  return params.launchId;
}

interface InitialViewProps {
  organizationName: string;
  onStart: () => void;
}

function InitialView(props: InitialViewProps) {
  const { organizationName, onStart } = props;
  const t = useTranslations('pages/launch');
  return (
    <VStack gap="form">
      <VStack gap="large" paddingBottom>
        <Typography variant="heading3">{t('InitialView.title')}</Typography>
        <Typography>
          {t('InitialView.description', { organizationName })}
        </Typography>
      </VStack>
      <VStack>
        <Button
          fullWidth
          preIcon={<RocketIcon />}
          size="large"
          type="button"
          onClick={onStart}
          label={t('InitialView.cta')}
        />
        <Typography variant="body3">
          {t.rich('InitialView.terms', {
            terms: (chunks) => (
              <a
                className="underline"
                href="https://letta.com/terms-of-service"
              >
                {chunks}
              </a>
            ),
            privacy: (chunks) => (
              <a className="underline" href="https://letta.com/privacy-policy">
                {chunks}
              </a>
            ),
          })}
        </Typography>
      </VStack>
    </VStack>
  );
}

interface MemoryVariablesViewProps {
  memoryVariableData: KeyValue[];
  setMemoryVariableData: Dispatch<SetStateAction<KeyValue[]>>;
  onSubmit: () => void;
}

function EnterMemoryVariablesView(props: MemoryVariablesViewProps) {
  const { memoryVariableData, setMemoryVariableData, onSubmit } = props;
  const t = useTranslations('pages/launch');

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(() => {
    if (memoryVariableData.some((variable) => !variable.value)) {
      setError(t('EnterMemoryVariablesView.error'));
      return;
    }

    onSubmit();
  }, [memoryVariableData, t, onSubmit]);

  const handleMemoryVariableChange = useCallback(
    (key: string, value: string) => {
      setMemoryVariableData((prev) => {
        return prev.map((variable) => {
          if (variable.key === key) {
            return {
              ...variable,
              value,
            };
          }

          return variable;
        });
      });
    },
    [setMemoryVariableData],
  );

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <VStack gap="form">
        {error && <Alert title={error} variant="destructive" fullWidth />}
        <Typography variant="heading3">
          {t('EnterMemoryVariablesView.heading')}
        </Typography>
        <Typography>{t('EnterMemoryVariablesView.title')}</Typography>
        {memoryVariableData.map((variable, index) => (
          <RawInput
            labelVariant="simple"
            key={index}
            fullWidth
            label={capitalize(variable.key)}
            value={variable.value}
            onChange={(e) => {
              handleMemoryVariableChange(variable.key, e.target.value);
            }}
          />
        ))}
        <Button
          fullWidth
          type="submit"
          label={t('EnterMemoryVariablesView.submit')}
        />
      </VStack>
    </Form>
  );
}

export default function LaunchLinkPage() {
  const launchId = useLaunchId();

  const [view, setView] = useState<'addVariables' | 'initial'>('initial');

  const t = useTranslations('pages/launch');

  const { data } = webApi.launchLinks.getLaunchLinkMetadataByLaunchId.useQuery({
    queryKey:
      webApiQueryKeys.launchLinks.getLaunchLinkMetadataByLaunchId(launchId),
    queryData: {
      params: {
        launchId,
      },
    },
  });

  const { mutate, isPending, isSuccess } =
    webApi.launchLinks.createShareChatFromLaunchLink.useMutation();

  const memoryVariables = useMemo(() => {
    return new Set(data?.body.memoryVariables.map((v) => v.key) || []);
  }, [data]);

  const [memoryVariableData, setMemoryVariableData] = useState<KeyValue[]>(
    () => {
      return Array.from(memoryVariables).map((variable) => ({
        key: variable,
        value: '',
      }));
    },
  );

  const areMemoryVariablesEntered = useMemo(() => {
    return memoryVariableData.every(
      (variable) => memoryVariables.has(variable.key) && variable.value,
    );
  }, [memoryVariables, memoryVariableData]);

  const handleStartChat = useCallback(() => {
    if (!areMemoryVariablesEntered) {
      setView('addVariables');
      return;
    }

    const memoryVariablesPayload = memoryVariableData.reduce(
      (acc, variable) => {
        return {
          ...acc,
          [variable.key]: variable.value,
        };
      },
      {},
    );

    mutate(
      {
        params: {
          agentTemplateId: data?.body.agentTemplateId || '',
        },
        body: {
          memoryVariables: memoryVariablesPayload,
        },
      },
      {
        onSuccess: (response) => {
          window.location.href = `/chat/${response.body.chatId}`;
        },
      },
    );
  }, [data, mutate, areMemoryVariablesEntered, memoryVariableData]);

  const showLoader = useMemo(
    () => isPending || isSuccess,
    [isPending, isSuccess],
  );

  return (
    <div className="w-[100dvw] h-[100dvh] relative flex justify-center items-center">
      <VStack
        gap="form"
        fullWidth
        /* eslint-disable-next-line react/forbid-component-props */
        className="max-w-[375px]"
        color="background-grey"
        padding="xxlarge"
      >
        {!showLoader ? (
          <>
            <LettaInvaderIcon size="xxlarge" />
            {view === 'initial' && (
              <InitialView
                onStart={handleStartChat}
                organizationName={data?.body.organizationName || ''}
              />
            )}
            {view === 'addVariables' && (
              <EnterMemoryVariablesView
                onSubmit={handleStartChat}
                memoryVariableData={memoryVariableData}
                setMemoryVariableData={setMemoryVariableData}
              />
            )}
          </>
        ) : (
          <LoadingEmptyStatusComponent
            loadingMessage={t('loading')}
            isLoading
          />
        )}
      </VStack>
    </div>
  );
}
