import { useMemo, Fragment } from 'react';
import { Popover } from '../../core/Popover/Popover';
import { VStack } from '../../framing/VStack/VStack';
import { Typography } from '../../core/Typography/Typography';
import { HStack } from '../../framing/HStack/HStack';
import { SwitchOrganizationIcon } from '../../icons';
import React from 'react';

export interface ServerNavigationItem {
  id: string;
  name: string;
  url: string;
  statusIndicator?: React.ReactNode;
}

interface ServerProps {
  server: ServerNavigationItem;
  postIcon?: React.ReactNode;
  onSelect?: (server: ServerNavigationItem) => void;
}

export function Server(props: ServerProps) {
  const { server, postIcon, onSelect } = props;
  return (
    <HStack
      paddingX="large"
      paddingY="small"
      fullWidth
      as="button"
      gap="large"
      onClick={() => onSelect?.(server)}
    >
      <VStack flex collapseWidth gap={false}>
        <HStack align="center">
          {server.statusIndicator}
          <Typography fullWidth noWrap overflow="ellipsis" variant="body2">
            {server.name}
          </Typography>
        </HStack>
        {server.url && (
          <Typography
            fullWidth
            noWrap
            overflow="ellipsis"
            color="muted"
            variant="body3"
          >
            {server.url}
          </Typography>
        )}
      </VStack>
      {postIcon}
    </HStack>
  );
}

interface NavigationDropdownProps {
  servers: ServerNavigationItem[];
  selectedServerUrl?: string;
  onSelect?: (server: ServerNavigationItem) => void;
}

export function ServerNavigationDropdown({
  servers,
  selectedServerUrl,
  onSelect,
}: NavigationDropdownProps) {
  const selectedServer = useMemo(() => {
    return servers.find((server) => server.url === selectedServerUrl);
  }, [servers, selectedServerUrl]);

  return (
    <Popover
      triggerAsChild
      align="start"
      className="max-w-[300px]"
      trigger={
        <HStack fullWidth justify="spaceBetween" position="relative" border>
          <Server
            server={selectedServer || servers[0]}
            onSelect={onSelect}
            postIcon={<SwitchOrganizationIcon />}
          />
        </HStack>
      }
    >
      {servers.map((server, index) => (
        <Fragment key={server.id + '_button'}>
          <Server server={server} onSelect={onSelect} />
          {index !== servers.length - 1 && (
            <div className="h-[1px] bg-gray-100" />
          )}
        </Fragment>
      ))}
    </Popover>
  );
}
