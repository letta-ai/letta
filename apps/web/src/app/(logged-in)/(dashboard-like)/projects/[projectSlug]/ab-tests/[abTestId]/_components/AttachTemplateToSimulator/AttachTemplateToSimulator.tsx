import type { OptionType } from '@letta-cloud/ui-component-library';
import {
  Button,
  HStack,
  isMultiValue,
  LettaLoader,
  RawAsyncSelect,
  RawInput,
  RawSelect,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useABTestId } from '../../../hooks/useABTestId/useABTestId';
import { useTranslations } from '@letta-cloud/translations';
import type { contracts } from '@letta-cloud/sdk-web';
import {
  type AgentTemplateType,
  webApi,
  webApiQueryKeys,
} from '@letta-cloud/sdk-web';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ServerInferResponses } from '@ts-rest/core';

interface SelectTemplateProps {
  setSelectedTemplate: (option: OptionType) => void;
  value?: OptionType;
}

function SelectTemplate(props: SelectTemplateProps) {
  const { setSelectedTemplate, value: selectedTemplate } = props;

  const { id: projectId } = useCurrentProject();
  const t = useTranslations('projects/ab-tests.AttachTemplateToSimulator');
  const { data } = webApi.agentTemplates.listAgentTemplates.useQuery({
    queryKey: webApiQueryKeys.agentTemplates.listAgentTemplatesWithSearch({
      includeLatestDeployedVersion: true,
      projectId,
    }),
    queryData: {
      query: {
        includeLatestDeployedVersion: true,
        projectId,
      },
    },
  });

  const formatOptions = useCallback((options: AgentTemplateType[]) => {
    return [
      ...options.map((a) => ({
        label: a.name,
        value: a.name,
        data: {
          latestVersion: a.latestDeployedVersion || '1',
        },
      })),
    ];
  }, []);

  const loadOptions = useCallback(
    async (inputValue: string) => {
      const response = await webApi.agentTemplates.listAgentTemplates.query({
        query: {
          search: inputValue,
          includeLatestDeployedVersion: true,
          projectId,
        },
      });

      if (response.status !== 200) {
        return [];
      }

      return formatOptions(response.body.agentTemplates);
    },
    [formatOptions, projectId],
  );

  return (
    <RawAsyncSelect
      fullWidth
      hideLabel
      label={t('label')}
      defaultOptions={data ? formatOptions(data.body.agentTemplates) : []}
      loadOptions={loadOptions}
      placeholder={t('placeholder')}
      isLoading={!data}
      onSelect={(option) => {
        if (!isMultiValue(option) && option) {
          setSelectedTemplate(option);
        }
      }}
      value={selectedTemplate}
    />
  );
}

interface VersionSelectorProps {
  selectedVersion?: OptionType;
  setSelectedVersion: (option: OptionType) => void;
  latestVersion?: string;
}

const currentValue = {
  // dont translate
  label: 'current',
  value: 'current',
};

function VersionSelector(props: VersionSelectorProps) {
  const { setSelectedVersion, latestVersion, selectedVersion } = props;

  const t = useTranslations('projects/ab-tests.VersionSelector');

  const latestVersionAsInt = useMemo(() => {
    return latestVersion ? parseInt(latestVersion, 10) : 1;
  }, [latestVersion]);

  const options = useMemo(() => {
    return [
      ...Array.from({ length: latestVersionAsInt }, (_, i) => ({
        label:
          i === latestVersionAsInt - 1
            ? t('latest', { value: i + 1 })
            : `${i + 1}`,
        value: `${i + 1}`,
      })),
      currentValue,
    ].toReversed();
  }, [latestVersionAsInt, t]);

  return (
    <RawSelect
      disabled={!latestVersion}
      __use_rarely_className="min-w-[85px] w-full max-w-[85px] bg-transparent"
      hideLabel
      styleConfig={{
        menuWidth: 200,
      }}
      value={selectedVersion || currentValue}
      onSelect={(option) => {
        if (!isMultiValue(option) && option) {
          setSelectedVersion(option);
        }
      }}
      label={t('label')}
      fullWidth
      options={options}
    />
  );
}

interface VariableViewerProps {
  fullTemplateName: string;
  setReady: (ready: boolean) => void;
}

function VariableViewer(props: VariableViewerProps) {
  const { fullTemplateName, setReady } = props;
  const t = useTranslations('projects/ab-tests.VariableViewer');
  const { data } =
    webApi.agentTemplates.getAgentTemplateMemoryVariables.useQuery({
      queryKey:
        webApiQueryKeys.agentTemplates.getAgentTemplateMemoryVariables(
          fullTemplateName,
        ),
      queryData: {
        query: {
          name: fullTemplateName,
        },
      },
      enabled: !!fullTemplateName,
    });

  useEffect(() => {
    if (!data || !fullTemplateName) {
      setReady(false);
      return;
    }

    setReady(true);
  }, [data, fullTemplateName, setReady]);

  const variables = useMemo(() => {
    return data?.body?.memoryVariables || [];
  }, [data]);

  if (!fullTemplateName) {
    return (
      <VStack padding>
        <Typography variant="body3" italic align="center">
          {t('noTemplateSelected')}
        </Typography>
      </VStack>
    );
  }

  if (!data) {
    return (
      <div className="items-center justify-center flex" style={{ height: 76 }}>
        <LettaLoader variant="grower" />
      </div>
    );
  }

  return (
    <VStack fullWidth fullHeight align="start">
      {variables.length > 0 ? (
        <VStack padding="small" fullWidth>
          {variables.map((variable) => (
            <RawInput
              key={variable}
              fullWidth
              label={variable}
              name={variable}
            />
          ))}
        </VStack>
      ) : (
        <VStack padding>
          <Typography variant="body3" italic align="center">
            {t('noVariables')}
          </Typography>
        </VStack>
      )}
    </VStack>
  );
}

function VariableSelector() {
  const t = useTranslations('projects/ab-tests.VariableSelector');

  const [selectedTemplate, setSelectedTemplate] = useState<OptionType>();
  const [selectedVersion, setSelectedVersion] =
    useState<OptionType>(currentValue);
  const abTestId = useABTestId();

  const [ready, setReady] = useState(false);

  const queryClient = useQueryClient();

  const { mutate, isPending } = webApi.abTest.attachAbTestTemplate.useMutation({
    onSuccess: (res) => {
      queryClient.setQueriesData<
        ServerInferResponses<typeof contracts.abTest.getAbTestTemplates, 200>
      >(
        {
          queryKey: webApiQueryKeys.abTest.getAbTestTemplates(abTestId),
        },
        (oldData) => {
          if (!oldData) {
            return oldData;
          }

          // insert the new template at the specified index
          return {
            status: 200,
            body: {
              ...oldData.body,
              templates: [...oldData.body.templates, res.body],
            },
          };
        },
      );
    },
  });

  const onSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedTemplate) {
        return;
      }

      const fullTemplateName = `${selectedTemplate.value}:${
        selectedVersion?.value || 'current'
      }`;

      const form = event.currentTarget;
      // extract variables from the form
      const formData = new FormData(form);
      const variables: Record<string, string> = {};

      formData.forEach((value, key) => {
        if (typeof value === 'string' && value.trim() !== '') {
          variables[key] = value.trim();
        }
      });

      mutate({
        params: {
          abTestId,
        },
        body: {
          templateName: fullTemplateName,
          memoryVariables: variables,
        },
      });
    },
    [abTestId, mutate, selectedTemplate, selectedVersion?.value],
  );

  return (
    <>
      <HStack padding="small" borderBottom>
        <SelectTemplate
          value={selectedTemplate}
          setSelectedTemplate={setSelectedTemplate}
        />
        <VersionSelector
          latestVersion={selectedTemplate?.data?.latestVersion}
          selectedVersion={selectedVersion}
          setSelectedVersion={setSelectedVersion}
        />
      </HStack>
      <form onSubmit={onSubmit} className="contents">
        <VStack padding="xsmall">
          <VStack
            border
            fullHeight
            fullWidth
            align="center"
            justify="center"
            color="background-grey"
            padding="xsmall"
          >
            <VariableViewer
              setReady={setReady}
              fullTemplateName={
                selectedTemplate
                  ? `${selectedTemplate.value}:${selectedVersion?.value || 'current'}`
                  : ''
              }
            />
          </VStack>
        </VStack>
        <VStack padding="small" borderTop>
          <Button
            busy={isPending}
            label={t('create')}
            color="primary"
            fullWidth
            type="submit"
            disabled={!ready || !selectedTemplate}
          />
        </VStack>
      </form>
    </>
  );
}

export function AttachTemplateToSimulator() {
  const t = useTranslations('projects/ab-tests.AttachTemplateToSimulator');

  return (
    <VStack fullHeight fullWidth align="center" justify="center">
      <VStack
        color="background"
        /* eslint-disable-next-line react/forbid-component-props */
        className="w-[315px] max-w-[315px]"
      >
        <VStack fullWidth>
          <Typography variant="body3" bold align="center">
            {t('title')}
          </Typography>
        </VStack>
        <VStack gap={false} border>
          <VariableSelector />
        </VStack>
      </VStack>
    </VStack>
  );
}
