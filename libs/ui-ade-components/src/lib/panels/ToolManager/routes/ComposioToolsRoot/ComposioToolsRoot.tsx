'use client';
import {
  Button,
  ComposioLogoMarkDynamic,
  ExternalLinkIcon,
  HStack,
  Link,
  LoadingEmptyStatusComponent,
  NiceGridDisplay,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { ToolManagerPage } from '../../components/ToolManagerPage/ToolManagerPage';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useMemo, useState } from 'react';
import { SearchTools } from '../../components/SearchTools/SearchTools';
import { useToolManagerState } from '../../hooks/useToolManagerState/useToolManagerState';

function AppsViewer() {
  const { data, isLoading, error } = webApi.composio.getComposioApps.useQuery({
    queryKey: webApiQueryKeys.composio.getComposioApps,
  });
  const [search, setSearch] = useState<string>('');

  const { setPath } = useToolManagerState();
  const t = useTranslations('ComposioToolsView');

  const apps = useMemo(() => {
    if (!data?.body) {
      return [];
    }

    if (!Array.isArray(data.body.items)) {
      return [];
    }

    return data.body.items.filter((v) => v?.meta?.actionsCount > 0);
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
                    setPath(`/composio/${app.name}`);
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

export function ComposioToolsRoot() {
  const t = useTranslations('ToolsEditor/ComposioToolsRoot');

  return (
    <ToolManagerPage>
      <VStack
        paddingTop="medium"
        fullHeight
        overflow="hidden"
        fullWidth
        gap={false}
      >
        <VStack gap="large" paddingX="xlarge" paddingBottom="xlarge">
          <HStack align="center" justify="spaceBetween">
            <HStack align="end">
              <ComposioLogoMarkDynamic size="xxlarge" />
              <Typography variant="heading4">Composio</Typography>
            </HStack>
            <Button
              href="https://composio.dev/"
              postIcon={<ExternalLinkIcon />}
              target="_blank"
              color="tertiary"
              label={t('visitWebsite')}
            />
          </HStack>
          <HStack width="contained">
            <Typography>
              {t.rich('description', {
                link: (chunks) => (
                  <Link
                    href="https://docs.letta.com/guides/mcp/setup"
                    target="_blank"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </Typography>
          </HStack>
        </VStack>
        <AppsViewer />
      </VStack>
    </ToolManagerPage>
  );
}
