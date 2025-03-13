import React, { Fragment } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  ExploreIcon,
  HStack,
  PlusIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import {
  isCurrentToolInViewOrEdit,
  useToolsExplorerState,
} from '../useToolsExplorerState/useToolsExplorerState';
import { ViewTool } from './ViewTool/ViewTool';
import { Hr } from '@react-email/components';
import { CurrentAgentToolsView } from './CurrentAgentToolsView/CurrentAgentToolsView';
import { LocalToolsView } from './LocalToolsView/LocalToolsView';
import { ComposioToolsView } from './ComposioToolsView/ComposioToolsView';
import {
  AllToolsViewStateProvider,
  useAllToolsViewState,
} from './hooks/useAllToolsViewState/useAllToolsViewState';
import { useToolCategoryDetails } from './hooks/useToolCategoryDetails/useToolCategoryDetails';
import { ViewMCPServers } from './ViewMCPServers/ViewMCPServers';

interface ToolCategoryButtonProps {
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  preIcon?: React.ReactNode | string;
  isSelected: boolean;
  onSelect: () => void;
}

function ToolCategoryButton(props: ToolCategoryButtonProps) {
  const { label, preIcon, isSelected, onSelect } = props;

  return (
    <Button
      size="small"
      label={label}
      preIcon={preIcon}
      color="tertiary"
      active={isSelected}
      onClick={() => {
        onSelect();
      }}
    />
  );
}

function ToolCategorySidebar() {
  const { category: selectedCategory, setCategory } = useAllToolsViewState();
  const categories = useToolCategoryDetails();
  const { startCreateTool } = useToolsExplorerState();
  const t = useTranslations('AllToolsView');

  return (
    <VStack gap="medium" paddingX paddingBottom="xxsmall">
      <HStack paddingTop="large" paddingBottom="small" align="center">
        <ExploreIcon />
        <Typography bold>{t('ToolCategorySidebar.title')}</Typography>
      </HStack>
      <Typography variant="body3" uppercase bold>
        {t('ToolCategorySidebar.pythonTools')}
      </Typography>
      <ToolCategoryButton
        label={categories.local.title}
        isSelected={'local' === selectedCategory}
        preIcon={categories.local.icon}
        onSelect={() => {
          setCategory('local');
        }}
      />
      <ToolCategoryButton
        label={categories.composio.title}
        isSelected={'composio' === selectedCategory}
        preIcon={categories.composio.icon}
        onSelect={() => {
          setCategory('composio');
        }}
      />
      <Button
        onClick={() => {
          startCreateTool();
        }}
        size="small"
        data-testid="start-create-tool"
        preIcon={<PlusIcon />}
        label={t('ToolCategorySidebar.create')}
        color="primary"
      />
      <Hr />
      <HStack>
        <Typography variant="body3" uppercase bold>
          {t('ToolCategorySidebar.mcpTools')}
        </Typography>
      </HStack>
      <ToolCategoryButton
        label={categories.mcp.title}
        isSelected={'mcp' === selectedCategory}
        preIcon={categories.mcp.icon}
        onSelect={() => {
          setCategory('mcp');
        }}
      />
    </VStack>
  );
}

function ToolsViewerContent() {
  const { category } = useAllToolsViewState();
  const { currentTool } = useToolsExplorerState();

  if (isCurrentToolInViewOrEdit(currentTool) && currentTool?.data) {
    return (
      <>
        <ViewTool showAddToolToAgent tool={currentTool.data} />
      </>
    );
  }

  if (category === 'current') {
    return <CurrentAgentToolsView />;
  }

  if (category === 'local') {
    return <LocalToolsView />;
  }

  if (category === 'mcp') {
    return <ViewMCPServers />;
  }

  if (category === 'composio') {
    return <ComposioToolsView />;
  }

  return null;
}

export function AllToolsView() {
  return (
    <AllToolsViewStateProvider>
      <HStack fullHeight gap={false}>
        {/* eslint-disable-next-line react/forbid-component-props */}
        <VStack
          color="background-grey"
          className="min-w-[225px] visibleSidebar:flex hidden"
          borderRight
        >
          <ToolCategorySidebar />
        </VStack>
        <VStack gap={false} fullHeight fullWidth>
          <ToolsViewerContent />
        </VStack>
      </HStack>
    </AllToolsViewStateProvider>
  );
}
