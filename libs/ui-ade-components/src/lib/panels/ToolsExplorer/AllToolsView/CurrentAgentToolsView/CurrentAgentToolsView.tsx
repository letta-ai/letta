import { useMemo, useState } from 'react';
import { useCurrentAgent } from '../../../../hooks';
import { NiceGridDisplay, VStack } from '@letta-cloud/ui-component-library';
import { SearchTools } from '../../shared/SearchTools/SearchTools';
import { useToolsExplorerState } from '../../useToolsExplorerState/useToolsExplorerState';
import { findProviderFromTags } from '../../findProviderFromTags/findProviderFromTags';
import { ToolCard } from '../ToolCard/ToolCard';
import { AllToolsViewHeader } from '../AllToolsViewHeader/AllToolsViewHeader';

export function CurrentAgentToolsView() {
  const [search, setSearch] = useState('');

  const { tools } = useCurrentAgent();
  const { setCurrentTool } = useToolsExplorerState();

  const filteredTools = useMemo(() => {
    return (tools || []).filter((tool) => {
      return (tool.name || '').toLowerCase().includes(search.toLowerCase());
    });
  }, [tools, search]);

  return (
    <VStack fullHeight overflow="hidden" fullWidth gap={false}>
      <AllToolsViewHeader />
      <VStack paddingX flex collapseHeight fullWidth>
        <SearchTools search={search} setSearch={setSearch} />
        <VStack overflowY="auto" flex collapseHeight>
          <NiceGridDisplay itemWidth="400px" itemHeight="95px">
            {filteredTools.map((tool) => {
              return (
                <ToolCard
                  key={tool.id}
                  name={tool.name || ''}
                  id={tool.id || ''}
                  type={tool.tool_type || 'custom'}
                  description={tool.description}
                  onSelect={() => {
                    setCurrentTool({
                      description: tool.description || '',
                      name: tool.name || '',
                      id: tool.id || '',
                      brand: findProviderFromTags(tool),
                      provider: findProviderFromTags(tool),
                      providerId: tool.name || '',
                    });
                  }}
                />
              );
            })}
          </NiceGridDisplay>
        </VStack>
      </VStack>
    </VStack>
  );
}
