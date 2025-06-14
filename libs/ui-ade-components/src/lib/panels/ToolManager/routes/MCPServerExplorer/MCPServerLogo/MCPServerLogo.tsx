import React, { useMemo } from 'react';
import { SpecificToolIcon } from '../../../components/SpecificToolIcon/SpecificToolIcon';
import { useRecommendedMCPServers } from '../hooks/useRecommendedMCPServers/useRecommendedMCPServers';

interface MCPServerLogoProps {
  serverUrl: string;
}

export function MCPServerLogo(props: MCPServerLogoProps) {
  const { serverUrl } = props;
  const recommendedServers = useRecommendedMCPServers();

  const recommendedServer = useMemo(() => {
    const baseUrl = new URL(serverUrl).origin;

    return recommendedServers.find((server) => server.baseUrl === baseUrl);
  }, [recommendedServers, serverUrl]);

  return recommendedServer ? (
    <div className="relative">{recommendedServer.logo}</div>
  ) : (
    <SpecificToolIcon toolType="external_mcp" />
  );
}
