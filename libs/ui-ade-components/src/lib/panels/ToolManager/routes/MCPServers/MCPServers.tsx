'use client';
import React, { useEffect, useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';

import {
  Badge,
  Button,
  ChevronDownIcon,
  HiddenOnMobile,
  HStack,
  LoadingEmptyStatusComponent,
  PlusIcon,
  Popover,
  Typography,
  VisibleOnMobile,
  VStack,
} from '@letta-cloud/ui-component-library';
import type { MCPServerItemType } from '@letta-cloud/sdk-core';
import { getIsStreamableOrHttpServer } from './types';
import { useToolsServiceListMcpServers } from '@letta-cloud/sdk-core';
import { ToolSearchInput } from '../../components/ToolSearchInput/ToolSearchInput';
import { cn } from '@letta-cloud/ui-styles';
import { SpecificToolIcon } from '../../components/SpecificToolIcon/SpecificToolIcon';
import { SingleMCPServer } from './SingleMCPServer/SingleMCPServer';
import { AddServerDialog } from './AddMCPServerDialog/AddMCPServerDialog';
import { useToolManagerState } from '../../hooks/useToolManagerState/useToolManagerState';
import { getObfuscatedMCPServerUrl } from '@letta-cloud/utils-shared';
import { MCPServerLogo } from '../MCPServerExplorer/MCPServerLogo/MCPServerLogo';
import { atom, useAtom } from 'jotai';

interface MCPServerListProps {
  search: string;
  onSearchChange: (search: string) => void;
  setSelectedServerKey: (serverKey: string) => void;
  selectedServerKey?: string | null;
  servers: MCPServerItemType[];
  isMobile?: boolean;
}

function MCPServerList(props: MCPServerListProps) {
  const {
    search,
    onSearchChange,
    setSelectedServerKey,
    selectedServerKey,
    servers,
    isMobile,
  } = props;
  const t = useTranslations('ToolsEditor/MCPServers');

  return (
    <VStack
      gap={false}
      fullHeight
      borderRight
      fullWidth
      className={!isMobile ? 'max-w-[240px]' : 'w-full'}
    >
      <ToolSearchInput
        placeholder={t('search.placeholder')}
        isMobile={isMobile}
        search={search}
        onSearchChange={onSearchChange}
      />
      <VStack overflowY="auto" collapseHeight flex gap="small" padding="small">
        <AddServerDialog
          trigger={
            <HStack
              padding="small"
              gap="small"
              justify="spaceBetween"
              align="center"
              fullWidth
              className="hover:bg-secondary-hover cursor-pointer"
            >
              <HStack fullWidth align="center" gap="medium">
                <div className="pl-1">
                  <MCPServerLogo serverUrl="" />
                </div>
                <VStack collapseWidth flex gap="small">
                  <Typography
                    fullWidth
                    overflow="ellipsis"
                    noWrap
                    variant={isMobile ? 'body' : 'body2'}
                  >
                    {t('AddServerDialog.addMcpServer')}
                  </Typography>
                </VStack>
              </HStack>
              <Button
                size="default"
                hideLabel
                preIcon={<PlusIcon />}
                label={t('AddServerDialog.addServer')}
                color="tertiary"
              />
            </HStack>
          }
        />
        {servers.map((server) => (
          <HStack
            padding="small"
            gap="small"
            justify="spaceBetween"
            align="center"
            fullWidth
            key={server.server_name}
            as="button"
            onClick={() => {
              if (server.server_name) {
                setSelectedServerKey(server.server_name);
              }
            }}
            className={cn(
              server.server_name === selectedServerKey
                ? 'bg-secondary-active'
                : '',
            )}
          >
            <HStack fullWidth align="center" gap="medium">
              <div className="min-w-[20px] h-[24px] items-center justify-center">
                <MCPServerLogo
                  serverUrl={
                    !getIsStreamableOrHttpServer(server)
                      ? server.command
                      : server.server_url
                  }
                />
              </div>
              <VStack collapseWidth flex gap="small" align="start">
                <Typography
                  fullWidth
                  overflow="ellipsis"
                  noWrap
                  variant={isMobile ? 'body' : 'body2'}
                >
                  {server.server_name || 'unnamed'}
                </Typography>
                {!isMobile && (
                  <Badge
                    size="small"
                    content={
                      !getIsStreamableOrHttpServer(server)
                        ? server.command
                        : getObfuscatedMCPServerUrl(server.server_url)
                    }
                    className="max-w-full truncate"
                  />
                )}
              </VStack>
            </HStack>
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}

export const selectedServerKeyAtom = atom<string | null>(null);

export function MCPServers() {
  const t = useTranslations('ToolsEditor/MCPServers');

  const [search, setSearch] = React.useState('');

  const { data: servers, isLoading, isError } = useToolsServiceListMcpServers();
  const [selectedServerKey, setSelectedServerKey] = useAtom(
    selectedServerKeyAtom,
  );

  const serversAsArray = useMemo(() => {
    return Object.entries(servers || {}).map(([key, server]) => ({
      ...server,
      key,
    }));
  }, [servers]);

  useEffect(() => {
    if (servers && serversAsArray.length > 0) {
      // Only auto-select the first server if no server is currently selected
      if (!selectedServerKey) {
        setSelectedServerKey(serversAsArray[0].server_name);
      } else {
        // Check if the currently selected server still exists after updates
        const currentServerStillExists = serversAsArray.some(
          (server) => server.server_name === selectedServerKey,
        );

        // If current selection is invalid, fall back to first server
        if (!currentServerStillExists) {
          setSelectedServerKey(serversAsArray[0].server_name);
        }
      }
    }
  }, [serversAsArray, servers, selectedServerKey, setSelectedServerKey]);

  const selectedServer = useMemo(() => {
    return Object.values(servers || {})?.find(
      ({ server_name: serverName }) => serverName === selectedServerKey,
    );
  }, [selectedServerKey, servers]);

  const filteredServers = useMemo(() => {
    return serversAsArray
      .filter((server) => {
        return server.server_name?.toLowerCase().includes(search.toLowerCase());
      })
      .sort((a, b) => {
        // Sort by server name alphabetically
        return (a.server_name || '').localeCompare(b.server_name || '');
      });
  }, [search, serversAsArray]);

  const { setPath } = useToolManagerState();

  return (
    <>
      {!servers || serversAsArray.length === 0 ? (
        <LoadingEmptyStatusComponent
          isLoading={isLoading}
          isError={isError}
          errorMessage={t('error')}
          loadingMessage={t('loading')}
          emptyMessage={t('empty')}
          emptyAction={
            <Button
              onClick={() => {
                setPath('/mcp-servers/new');
              }}
              label={t('connect')}
              color="primary"
              fullWidth
            />
          }
        />
      ) : (
        <HStack gap={false} fullHeight fullWidth>
          <HiddenOnMobile>
            <MCPServerList
              search={search}
              onSearchChange={setSearch}
              selectedServerKey={selectedServerKey}
              setSelectedServerKey={setSelectedServerKey}
              servers={filteredServers}
            />
          </HiddenOnMobile>
          <VStack flex collapseWidth fullHeight gap={false}>
            <VisibleOnMobile>
              <HStack color="background-grey" borderBottom fullWidth>
                <HStack paddingX="medium" height="header-sm" align="center">
                  <Popover
                    className="max-h-[300px] overflow-auto"
                    triggerAsChild
                    align="start"
                    trigger={
                      <Button
                        size="small"
                        fullWidth
                        color="tertiary"
                        preIcon={<SpecificToolIcon toolType="external_mcp" />}
                        postIcon={<ChevronDownIcon />}
                        label={selectedServer?.server_name || t('selectServer')}
                      />
                    }
                  >
                    <MCPServerList
                      search={search}
                      onSearchChange={setSearch}
                      selectedServerKey={selectedServerKey}
                      setSelectedServerKey={setSelectedServerKey}
                      servers={filteredServers}
                      isMobile
                    />
                  </Popover>
                </HStack>
              </HStack>
            </VisibleOnMobile>
            {!selectedServer ? (
              <LoadingEmptyStatusComponent emptyMessage={t('select')} />
            ) : (
              <SingleMCPServer server={selectedServer} />
            )}
          </VStack>
        </HStack>
      )}
    </>
  );
}
