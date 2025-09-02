import {
  VStack,
  HStack,
  Button,
  Typography,
  PlusIcon,
  Frame,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import {
  CreateToolDialog,
  MCPServers,
  MCPServerExplorer,
  useToolManagerRouteCopy,
  ToolManagerProvider,
} from '@letta-cloud/ui-ade-components';
import React, { useState } from 'react';

interface DesktopToolManagerLayoutProps {
  children: React.ReactNode;
  onCategoryChange?: (category: string) => void;
  selectedCategory?: string;
  categoryCounts?: Record<string, number>;
}

type ViewMode = 'mcp-explorer' | 'mcp-servers' | 'tools';

interface SidebarSectionProps {
  title: string;
  children: React.ReactNode;
}

function SidebarSection({ title, children }: SidebarSectionProps) {
  return (
    <VStack gap="small" fullWidth>
      <VStack paddingX="small">
        <Typography variant="body3" color="default" bold>
          {title}
        </Typography>
      </VStack>
      <VStack gap="small" fullWidth>
        {children}
      </VStack>
    </VStack>
  );
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}

function SidebarItem({
  icon,
  label,
  count,
  active,
  onClick,
}: SidebarItemProps) {
  const displayLabel = count !== undefined ? `${label} (${count})` : label;

  return (
    <Button
      fullWidth
      size="small"
      color={active ? 'primary' : 'tertiary'}
      preIcon={icon}
      label={displayLabel}
      onClick={onClick}
      align="left"
    />
  );
}

export function DesktopToolManagerLayout({
  children,
  onCategoryChange,
  selectedCategory = 'custom',
  categoryCounts = {},
}: DesktopToolManagerLayoutProps) {
  const t = useTranslations('tools/layout');
  const [viewMode, setViewMode] = useState<ViewMode>('tools');

  const copy = useToolManagerRouteCopy();

  function handleCategoryChange(category: string) {
    if (category === 'mcp-servers') {
      setViewMode('mcp-servers');
    } else {
      setViewMode('tools');
      onCategoryChange?.(category);
    }
  }

  function handleAddMcpServer() {
    setViewMode('mcp-explorer');
  }

  return (
    <ToolManagerProvider>
      <HStack fullWidth fullHeight gap={false}>
        <VStack
          borderRight
          color="background-grey"
          gap="medium"
          padding="small"
          className="w-[200px] min-w-[200px] max-w-[200px]"
          overflowY="auto"
        >
          <SidebarSection title={t('nav.allTools')}>
            <SidebarItem
              icon={copy.customTools.icon}
              label={copy.customTools.title as string}
              count={categoryCounts.custom}
              active={selectedCategory === 'custom'}
              onClick={() => {
                handleCategoryChange('custom');
              }}
            />
            <SidebarItem
              icon={copy.multiAgentTools.icon}
              label={copy.multiAgentTools.title as string}
              count={categoryCounts['multi-agent']}
              active={selectedCategory === 'multi-agent'}
              onClick={() => {
                handleCategoryChange('multi-agent');
              }}
            />
            <SidebarItem
              icon={copy.utilityTools.icon}
              label={copy.utilityTools.title as string}
              count={categoryCounts.utility}
              active={selectedCategory === 'utility'}
              onClick={() => {
                handleCategoryChange('utility');
              }}
            />
            <SidebarItem
              icon={copy.lettaTools.icon}
              label={copy.lettaTools.title as string}
              count={categoryCounts.base}
              active={selectedCategory === 'base'}
              onClick={() => {
                handleCategoryChange('base');
              }}
            />
            <CreateToolDialog
              trigger={
                <Button
                  fullWidth
                  size="xsmall"
                  color="secondary"
                  preIcon={<PlusIcon />}
                  label={t('createTool')}
                  align="left"
                  bold
                  data-testid="start-create-tool"
                />
              }
            />
          </SidebarSection>

          <SidebarSection title={t('nav.mcpServers')}>
            <SidebarItem
              icon={copy.mcpServers.icon}
              label={copy.mcpServers.title as string}
              count={categoryCounts['mcp-servers']}
              active={selectedCategory === 'mcp-servers'}
              onClick={() => {
                handleCategoryChange('mcp-servers');
              }}
            />
            <Button
              fullWidth
              size="xsmall"
              color="secondary"
              preIcon={<PlusIcon />}
              label={t('addMCPServer')}
              onClick={handleAddMcpServer}
              align="left"
              bold
              data-testid="start-create-tool"
            />
          </SidebarSection>
        </VStack>

        <Frame fullWidth fullHeight>
          {viewMode === 'tools' && children}
          {viewMode === 'mcp-servers' && <MCPServers />}
          {viewMode === 'mcp-explorer' && <MCPServerExplorer />}
        </Frame>
      </HStack>
    </ToolManagerProvider>
  );
}
