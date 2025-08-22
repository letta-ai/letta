'use client';
import type { Tool } from '@letta-cloud/sdk-core';
import {
  Button,
  ChevronDownIcon,
  HiddenOnMobile,
  HStack,
  LoadingEmptyStatusComponent,
  Popover,
  Typography,
  VisibleOnMobile,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useEffect, useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { SpecificToolIcon } from '../SpecificToolIcon/SpecificToolIcon';
import { cn } from '@letta-cloud/ui-styles';
import { ComposioToolViewer } from '../ComposioToolViewer/ComposioToolViewer';
import { LocalToolViewer } from '../LocalToolViewer/LocalToolViewer';
import { ToolSearchInput } from '../ToolSearchInput/ToolSearchInput';
import { useStagedCode } from '../../hooks/useStagedCode/useStagedCode';
import { LettaToolViewer } from '../LettaToolViewer/LettaToolViewer';
import { MCPToolViewer } from '../MCPToolViewer/MCPToolViewer';
import { isLettaTool } from '@letta-cloud/sdk-core';
import { useFeatureFlag } from '@letta-cloud/sdk-web';
import { CreateToolDialog } from '../../ToolManager';

interface ToolButtonProps {
  tool: Tool;
  selected: boolean;
  onClick: () => void;
}

function ToolButton(props: ToolButtonProps) {
  const { tool, selected, onClick } = props;
  const { isDirty } = useStagedCode(tool);
  const { data: typescriptToolsEnabled } = useFeatureFlag('TYPESCRIPT_TOOLS');

  // Determine file extension based on source_type
  function getFileExtension() {
    if (tool.tool_type !== 'custom') return '';
    if (!typescriptToolsEnabled) return '.py';
    return tool.source_type === 'typescript' ? '.ts' : '.py';
  }

  return (
    <HStack
      paddingY="xxsmall"
      paddingX="xxsmall"
      gap="small"
      align="center"
      fullWidth
      justify="spaceBetween"
      as="button"
      onClick={onClick}
      className={cn(selected ? 'bg-secondary-active' : '')}
    >
      <HStack gap="small" align="center" overflow="hidden">
        <div className="min-w-[20px] h-[24px] items-center justify-center">
          <SpecificToolIcon
            toolType={tool.tool_type}
            sourceType={tool.source_type}
          />
        </div>
        <Typography fullWidth overflow="ellipsis" noWrap variant="body2">
          {tool.name || 'unnamed'}
          {getFileExtension()}
        </Typography>
      </HStack>
      {isDirty && tool.tool_type === 'custom' && (
        <div className="w-[8px] h-[8px] bg-primary rounded-full" />
      )}
    </HStack>
  );
}

interface ToolSidebarNavigatorProps {
  tools: Tool[];
  search: string;
  onSearchChange: (search: string) => void;
  setSelectedToolId: (toolId: string) => void;
  selectedToolId: string | null;
  isMobile?: boolean;
}

export function ToolSidebarNavigator(props: ToolSidebarNavigatorProps) {
  const {
    tools,
    search,
    isMobile,
    selectedToolId,
    onSearchChange,
    setSelectedToolId,
  } = props;

  const t = useTranslations('ToolsEditor');

  return (
    <VStack
      gap={false}
      fullHeight
      borderRight
      fullWidth
      color="background-grey"
      className={!isMobile ? 'max-w-[220px]' : 'w-full'}
    >
      <ToolSearchInput
        isMobile={isMobile}
        search={search}
        placeholder={t('search.placeholder')}
        onSearchChange={onSearchChange}
      />
      <VStack
        padding="small"
        overflowY="auto"
        fullWidth
        collapseHeight
        flex
        gap="small"
      >
        {tools.map((tool) => (
          <ToolButton
            key={tool.id}
            tool={tool}
            selected={tool.id === selectedToolId}
            onClick={() => {
              if (tool.id) {
                setSelectedToolId(tool.id);
              }
            }}
          />
        ))}
      </VStack>
    </VStack>
  );
}

interface SelectedToolViewerProps {
  selectedTool: Tool | null;
}

function SelectedToolViewer(props: SelectedToolViewerProps) {
  const { selectedTool } = props;
  const t = useTranslations('ToolsEditor');

  if (!selectedTool) {
    return (
      <LoadingEmptyStatusComponent
        emptyMessage={t('emptyMessage')}
        emptyAction={
          <CreateToolDialog trigger={<Button label={t('createTool')} />} />
        }
      />
    );
  }

  if (isLettaTool(selectedTool.tool_type)) {
    return <LettaToolViewer tool={selectedTool} />;
  }

  switch (selectedTool.tool_type) {
    case 'external_composio':
      if (!selectedTool.name) {
        return 'Invalid tool';
      }

      return (
        <ComposioToolViewer
          composioToolKey={selectedTool.name}
          name={selectedTool.name}
          description={selectedTool.description || ''}
          tool={selectedTool}
        />
      );
    case 'external_mcp':
      return (
        <MCPToolViewer
          tool={selectedTool}
          tags={selectedTool.tags || []}
          name={selectedTool.name || ''}
          attachedId={selectedTool.id || ''}
          description={selectedTool.description || ''}
        />
      );
    case 'custom':
      return <LocalToolViewer tool={selectedTool} />;
    default:
      return null;
  }
}

interface ToolsEditorProps {
  allTools: Tool[];
  filteredTools: Tool[];
  selectedToolId: string | null;
  setSelectedToolId: (toolId: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
}

export function ToolsEditor(props: ToolsEditorProps) {
  const {
    allTools,
    selectedToolId,
    setSelectedToolId,
    filteredTools,
    search,
    onSearchChange,
  } = props;

  const t = useTranslations('ToolsEditor');

  const selectedTool = useMemo(() => {
    return allTools.find((tool) => tool.id === selectedToolId);
  }, [selectedToolId, allTools]);

  useEffect(() => {
    if (
      allTools &&
      allTools.length >= 1 &&
      !selectedTool &&
      allTools?.[0]?.id
    ) {
      setSelectedToolId(allTools[0].id);
    }
  }, [allTools, selectedTool, setSelectedToolId]);

  return (
    <HStack gap={false} fullWidth fullHeight>
      <HiddenOnMobile>
        <ToolSidebarNavigator
          tools={filteredTools}
          search={search}
          selectedToolId={selectedToolId}
          onSearchChange={onSearchChange}
          setSelectedToolId={setSelectedToolId}
        />
      </HiddenOnMobile>
      <VStack fullWidth fullHeight gap={false}>
        <VisibleOnMobile>
          <HStack color="background-grey" borderBottom fullWidth>
            <HStack
              paddingX="medium"
              minHeight="header-sm"
              height="header-sm"
              align="center"
            >
              <Popover
                className="max-h-[300px] overflow-auto"
                triggerAsChild
                align="start"
                trigger={
                  <Button
                    size="small"
                    fullWidth
                    color="tertiary"
                    preIcon={
                      selectedTool?.tool_type && (
                        <SpecificToolIcon
                          toolType={selectedTool.tool_type}
                          sourceType={selectedTool.source_type}
                        />
                      )
                    }
                    postIcon={<ChevronDownIcon />}
                    label={selectedTool?.name || t('selectTool')}
                  />
                }
              >
                <ToolSidebarNavigator
                  tools={filteredTools}
                  search={search}
                  selectedToolId={selectedToolId}
                  isMobile
                  onSearchChange={onSearchChange}
                  setSelectedToolId={setSelectedToolId}
                />
              </Popover>
            </HStack>
          </HStack>
        </VisibleOnMobile>
        <SelectedToolViewer
          key={selectedTool?.id}
          selectedTool={selectedTool || null}
        />
      </VStack>
    </HStack>
  );
}
