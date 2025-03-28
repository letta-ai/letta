import * as React from 'react';
import { Popover } from '../../core/Popover/Popover';
import { VStack } from '../../framing/VStack/VStack';
import { Typography } from '../../core/Typography/Typography';
import { StatusIndicator } from '../../core/StatusIndicator/StatusIndicator';
import type { StatusIndicatorVariantProps } from '../../core/StatusIndicator/StatusIndicator';
import { HStack } from '../../framing/HStack/HStack';
import { SwitchOrganizationIcon } from '../../icons';

interface ServerProps {
  id: string;
  name: string;
  url?: string;
  status?: StatusIndicatorVariantProps['status'];
}

interface NavigationDropdownProps {
  trigger?: React.ReactNode;
  servers: ServerProps[];
  onClick?: (server: ServerProps) => void;
}

export function Server(server: ServerProps) {
  return (
    <HStack className={`pl-4 pr-4 ${server.url ? '' : 'opacity-50'}`}>
      {server.status && <StatusIndicator status={server.status} />}
      <VStack gap="small" paddingLeft="small">
        <Typography variant="body2">{server.name}</Typography>
        {server.url && <Typography variant="body2">{server.url}</Typography>}
      </VStack>
    </HStack>
  );
}

export function NavigationDropdown({
  servers,
  trigger,
  onClick,
}: NavigationDropdownProps) {
  return (
    <>
      <HStack>
        <Popover
          trigger={
            <HStack
              fullWidth
              justify="spaceBetween"
              className="border border-background-grey-100 py-2 pr-4"
            >
              {trigger}
              <SwitchOrganizationIcon />
            </HStack>
          }
        >
          <VStack gap={null} paddingY="small">
            {servers.map((server) => (
              <>
                <button
                  key={server.id + '_button'}
                  onClick={() => onClick?.(server)}
                >
                  <Server
                    id={server.id}
                    name={server.name}
                    url={server.url}
                    status={server.status}
                  />
                </button>
                {servers.indexOf(server) !== servers.length - 1 && (
                  <div className="h-[1px] bg-gray-100 my-2" />
                )}
              </>
            ))}
          </VStack>
        </Popover>
      </HStack>
    </>
  );
}
