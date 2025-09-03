import { useTranslations } from '@letta-cloud/translations';
import { ToolManagerPage } from '../../components/ToolManagerPage/ToolManagerPage';
import { useToolManagerState } from '../../hooks/useToolManagerState/useToolManagerState';
import { useCallback, useMemo } from 'react';
import {
  COMPOSIO_KEY_NAME,
  webApi,
  webApiQueryKeys,
} from '@letta-cloud/sdk-web';
import {
  Alert,
  Button,
  HStack,
  InlineCode,
  LoadingEmptyStatusComponent,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { ComposioAppHeader } from '../../components/ComposioAppHeader/ComposioAppHeader';
import { useCurrentAgent, useCurrentAgentMetaData } from '../../../../../hooks';
import { AttachDetachButton } from '../../components/AttachDetachButton/AttachDetachButton';
import { SpecificToolIcon } from '../../components/SpecificToolIcon/SpecificToolIcon';
import { capitalize } from 'lodash-es';
import { useIsComposioConnected } from '../../hooks/useIsComposioConnected/useIsComposioConnected';

interface ActionsListProps {
  appName: string;
}

function ActionsList(props: ActionsListProps) {
  const { appName } = props;

  const { data, isLoading, isError } =
    webApi.composio.listComposioActions.useQuery({
      queryKey: webApiQueryKeys.composio.listComposioActions({
        app: appName.toUpperCase(),
      }),
      refetchOnWindowFocus: false,
      queryData: {
        query: {
          app: appName.toUpperCase(),
        },
      },
    });
  const { tools } = useCurrentAgent();

  const getAttachedTool = useCallback(
    (toolName: string) => {
      return (tools || []).find(
        (tool) =>
          (tool.name || '').toLowerCase() === toolName.toLowerCase() &&
          tool.tool_type === 'external_composio',
      );
    },
    [tools],
  );

  const t = useTranslations('ToolsEditor/ComposioSpecificAppTools');

  const toolDetails = useMemo(() => {
    return data?.body.items;
  }, [data]);

  if (!toolDetails) {
    return (
      <LoadingEmptyStatusComponent
        isLoading={isLoading}
        isError={isError}
        loadingMessage={t('ActionsList.loading')}
        errorMessage={t('ActionsList.error')}
      />
    );
  }

  return (
    <VStack collapseHeight overflowY="auto" flex>
      {toolDetails.map((tool) => (
        <HStack
          color="background-grey"
          padding="small"
          justify="spaceBetween"
          key={tool.enum}
        >
          <VStack fullWidth>
            <HStack justify="spaceBetween" fullWidth align="center">
              <HStack gap="medium" color="brand-light">
                <SpecificToolIcon toolType="external_composio" />
                <Typography bold fullWidth noWrap overflow="ellipsis">
                  {tool.name}
                </Typography>
              </HStack>
              <AttachDetachButton
                idToAttach={tool.name}
                attachedId={getAttachedTool(tool.name)?.id}
                toolType="external_composio"
                toolName={tool.name}
              />
            </HStack>
            <Typography fullWidth>{tool.description}</Typography>
          </VStack>
        </HStack>
      ))}
    </VStack>
  );
}

export function ComposioSpecificAppTools() {
  const { currentPath } = useToolManagerState();

  const appName = useMemo(() => {
    const pathParts = currentPath?.split('/');
    return pathParts?.[pathParts.length - 1] || '';
  }, [currentPath]);

  const { data } = webApi.composio.getComposioApps.useQuery({
    queryKey: webApiQueryKeys.composio.getComposioApps,
  });

  const t = useTranslations('ToolsEditor/ComposioSpecificAppTools');

  const {
    isConnected: isComposioConnected,
    isLoading: isComposioConnectedLoading,
  } = useIsComposioConnected();
  const showComposioSetupBanner = useMemo(() => {
    if (isComposioConnectedLoading) {
      return false;
    }

    return !isComposioConnected;
  }, [isComposioConnected, isComposioConnectedLoading]);

  const { isLocal } = useCurrentAgentMetaData();

  const currentApp = useMemo(() => {
    if (!data?.body) {
      return null;
    }

    return data.body.items.find((app) => app.name === appName);
  }, [data, appName]);

  return (
    <ToolManagerPage
      breadcrumbs={[
        {
          label: appName,
        },
      ]}
    >
      <VStack
        fullHeight
        paddingTop="medium"
        fullWidth
        overflow="hidden"
        borderBottom
        gap="large"
        paddingX="xlarge"
        paddingBottom="xlarge"
      >
        {showComposioSetupBanner && (
          <Alert variant="warning" title={t('connectComposio.title')}>
            <VStack>
              {isLocal ? (
                <Typography overrideEl="span">
                  {t.rich('connectComposio.descriptionLocal', {
                    code: () => <InlineCode code={COMPOSIO_KEY_NAME} />,
                  })}
                </Typography>
              ) : (
                <Typography overrideEl="span">
                  {t('connectComposio.descriptionRemote')}
                </Typography>
              )}
              {!isLocal && (
                <HStack>
                  <Button
                    target="_blank"
                    href="/settings/organization/integrations/composio"
                    label={t('connectComposio.connect')}
                    color="primary"
                  />
                </HStack>
              )}
            </VStack>
          </Alert>
        )}
        <ComposioAppHeader name={capitalize(appName)} logo={currentApp?.logo} />
        <HStack width="contained">
          <Typography>{currentApp?.description}</Typography>
        </HStack>
        <ActionsList appName={appName} />
      </VStack>
    </ToolManagerPage>
  );
}
