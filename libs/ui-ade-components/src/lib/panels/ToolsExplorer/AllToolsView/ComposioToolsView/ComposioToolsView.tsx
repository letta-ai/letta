import { useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  Breadcrumb,
  Button,
  HStack,
  LoadingEmptyStatusComponent,
  NiceGridDisplay,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import type { ComposioActionType, ComposioAppType } from '@letta-cloud/sdk-web';
import { SearchTools } from '../../shared/SearchTools/SearchTools';
import { ToolCard } from '../ToolCard/ToolCard';
import { useToolsExplorerState } from '../../useToolsExplorerState/useToolsExplorerState';
import { capitalize } from 'lodash-es';
import {
  AllToolsViewHeader,
  ReturnToCategoryButton,
} from '../AllToolsViewHeader/AllToolsViewHeader';
import { ToolAppHeader } from '../../ToolAppHeader/ToolAppHeader';
import { atom, useAtom } from 'jotai';

interface AppsViewerProps {
  onSelectApp: (app: ComposioAppType) => void;
}

function AppsViewer(props: AppsViewerProps) {
  const { data, isLoading, error } = webApi.composio.getComposioApps.useQuery({
    queryKey: webApiQueryKeys.composio.getComposioApps,
  });
  const { onSelectApp } = props;
  const [search, setSearch] = useState<string>('');

  const t = useTranslations('ComposioToolsView');

  const apps = useMemo(() => {
    if (!data?.body) {
      return [];
    }

    return data.body.items;
  }, [data]);

  const filteredApps = useMemo(() => {
    if (!search) {
      return apps;
    }

    return apps.filter((app) => {
      return app.name.toLowerCase().includes(search.toLowerCase());
    });
  }, [apps, search]);

  if (!data || isLoading || error) {
    return (
      <LoadingEmptyStatusComponent
        isLoading={isLoading}
        loadingMessage={t('loadingMessage')}
        isError={!!error}
        errorMessage={t('errorMessage')}
      />
    );
  }

  return (
    <VStack
      paddingX
      fullHeight
      fullWidth
      /* hack to keep the outline on the search input */
      className="pt-[1px]"
      overflow="hidden"
    >
      <SearchTools search={search} setSearch={setSearch} />
      <HStack paddingTop="xxsmall">
        <Typography variant="body2" bold>
          {t('showing', {
            count: filteredApps.length,
            total: apps.length,
          })}
        </Typography>
      </HStack>
      <VStack collapseHeight flex overflowY="auto">
        <NiceGridDisplay>
          {filteredApps.map((app) => {
            return (
              <VStack padding="small" color="background-grey" key={app.key}>
                <VStack fullHeight>
                  <VStack>
                    <div>
                      <HStack border className="w-[32px] sh-[32px]">
                        <img
                          className="w-[32px]"
                          src={app.logo}
                          alt={app.name}
                        />
                      </HStack>
                    </div>
                    <Typography bold>{app.name}</Typography>
                  </VStack>
                  <div className="line-clamp-4">
                    <Typography>{app.description}</Typography>
                  </div>
                </VStack>
                <Button
                  onClick={() => {
                    onSelectApp(app);
                  }}
                  color="secondary"
                  fullWidth
                  label={t('openApp')}
                />
              </VStack>
            );
          })}
        </NiceGridDisplay>
      </VStack>
    </VStack>
  );
}

interface ComposioActionsListProps {
  actions: ComposioActionType[];
  app: ComposioAppType;
}

function ComposioActionsList(props: ComposioActionsListProps) {
  const { actions, app } = props;
  const { setCurrentTool } = useToolsExplorerState();

  return (
    <VStack>
      {actions.map((action) => {
        return (
          <ToolCard
            key={action.enum}
            name={action.name || ''}
            id={action.name || ''}
            type="external_composio"
            description={action.description}
            onSelect={() => {
              setCurrentTool({
                description: action.description || '',
                name: action.name || '',
                id: action.enum || '',
                imageUrl: app.logo,
                brand: app.name,
                provider: 'composio',
                providerId: action.enum,
              });
            }}
          />
        );
      })}
    </VStack>
  );
}

interface ActionsViewerProps {
  app: ComposioAppType;
}

function ComposioActionsView(props: ActionsViewerProps) {
  const { app } = props;
  const { data, isLoading, error } =
    webApi.composio.listComposioActions.useQuery({
      queryKey: webApiQueryKeys.composio.listComposioActions({ app: app.key }),
      queryData: {
        query: {
          app: app.key,
        },
      },
    });

  const [search, setSearch] = useState<string>('');

  const actions = useMemo(() => {
    if (!data?.body) {
      return [];
    }

    return data.body.items;
  }, [data]);

  const filteredActions = useMemo(() => {
    if (!search) {
      return actions;
    }

    return actions.filter((action) => {
      return action.name.toLowerCase().includes(search.toLowerCase());
    });
  }, [actions, search]);

  const t = useTranslations('ComposioActionsView');

  return (
    <VStack overflow="hidden" paddingX fullHeight fullWidth>
      <VStack paddingBottom borderBottom>
        <VStack align="start">
          <div>
            <HStack border className="w-[32px] sh-[32px]">
              <img className="w-[32px]" src={app.logo} alt={app.name} />
            </HStack>
          </div>
          <Typography bold>{capitalize(app.name)}</Typography>
          <Typography>{app.description}</Typography>
        </VStack>
      </VStack>
      <SearchTools search={search} setSearch={setSearch} />
      <VStack overflowY="auto" flex collapseHeight>
        {!data || isLoading || error || actions.length === 0 ? (
          <LoadingEmptyStatusComponent
            isLoading={isLoading}
            loadingMessage={t('loadingMessage')}
            isError={!!error}
            emptyMessage={t('emptyMessage')}
            errorMessage={t('errorMessage')}
          />
        ) : (
          <VStack>
            <ComposioActionsList actions={filteredActions} app={app} />
          </VStack>
        )}
      </VStack>
    </VStack>
  );
}

const composioSelectedApp = atom<ComposioAppType | null>(null);

export function ComposioToolsView() {
  const [selectedApp, setSelectedApp] = useAtom(composioSelectedApp);

  if (!selectedApp) {
    return (
      <VStack fullHeight overflow="hidden" fullWidth gap={false}>
        <AllToolsViewHeader />
        <AppsViewer onSelectApp={setSelectedApp} />
      </VStack>
    );
  }

  return (
    <VStack fullHeight overflow="hidden" fullWidth gap={false}>
      <ToolAppHeader>
        <Breadcrumb
          size="small"
          items={[
            {
              label: 'root',
              contentOverride: (
                <ReturnToCategoryButton
                  onReturn={() => {
                    setSelectedApp(null);
                  }}
                  currentCategory="composio"
                />
              ),
            },
            {
              onClick: () => {
                setSelectedApp(null);
              },
              label: capitalize(selectedApp.name),
            },
          ]}
        />
      </ToolAppHeader>
      <ComposioActionsView app={selectedApp} />
    </VStack>
  );
}
