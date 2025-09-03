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
    let baseUrl: string;
    try {
      baseUrl = new URL(serverUrl).origin;
    } catch {
      // If not a valid URL with protocol, try to match the full URL
      console.warn('Possible invalid MCP server URL: ', serverUrl);
      baseUrl = serverUrl;
    }

    return recommendedServers.find((server) => server.baseUrl === baseUrl);
  }, [recommendedServers, serverUrl]);

  return recommendedServer ? (
    <div className="relative">{recommendedServer.logo}</div>
  ) : (
    <SpecificToolIcon toolType="external_mcp" />
  );
}
