import { useCallback, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  type ListMcpServersResponse,
  useToolsServiceAddMcpServer,
  UseToolsServiceListMcpServersKeyFn,
  useToolsServiceListMcpServers,
} from '@letta-cloud/sdk-core';
import { useToolManagerState } from '../../../../hooks/useToolManagerState/useToolManagerState';
import { generateServerName } from '../../../MCPServers/AddMCPServerDialog/AddMCPServerDialog';
import type { CustomUrlRecommendedServer } from '../useRecommendedMCPServers/useRecommendedMCPServers';
import { SERVER_CONFIGS } from '../../constants';

export function useMCPServerDialog(server: CustomUrlRecommendedServer) {
  const { setPath, setSelectedServerKey } = useToolManagerState();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Get existing servers
  const { data: existingServers } = useToolsServiceListMcpServers();

  const config = SERVER_CONFIGS[server.id];

  // Only generate server name if not a custom naming server (like Pipedream)
  const serverName = useMemo(
    () =>
      config?.customNaming
        ? server.name
        : generateServerName(server.name, existingServers),
    [config?.customNaming, existingServers, server.name],
  );

  const { mutate, isPending, isError, reset } = useToolsServiceAddMcpServer({
    onSuccess: (response) => {
      queryClient.setQueriesData<ListMcpServersResponse | undefined>(
        { queryKey: UseToolsServiceListMcpServersKeyFn() },
        () =>
          response.reduce((acc, item) => {
            acc[item.server_name] = item;
            return acc;
          }, {} as ListMcpServersResponse),
      );
      setOpen(false);

      // Select the newly created server and navigate to mcp-servers
      if (response.length > 0) {
        setSelectedServerKey(response[0].server_name);
      }
      setPath('/mcp-servers');
    },
  });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setOpen(open);
      if (!open) reset();
    },
    [reset],
  );

  return {
    open,
    setOpen,
    mutate,
    isPending,
    isError,
    handleOpenChange,
    serverName,
  };
}
