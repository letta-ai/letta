import React from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  HStack,
  Link,
  LoadingEmptyStatusComponent,
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
  type ToolViewerCategory,
  useAllToolsViewState,
} from './hooks/useAllToolsViewState/useAllToolsViewState';
import { useToolCategoryDetails } from './hooks/useToolCategoryDetails/useToolCategoryDetails';

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
    <VStack gap="medium" paddingY="xxsmall">
      {Object.entries(categories).map(([category, details]) => {
        return (
          <>
            <ToolCategoryButton
              label={details.title}
              isSelected={category === selectedCategory}
              preIcon={details.icon}
              onSelect={() => {
                setCategory(category as ToolViewerCategory);
              }}
            />
            {category === 'current' && <Hr />}
          </>
        );
      })}
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
    </VStack>
  );
}

function ToolsViewerContent() {
  const { category } = useAllToolsViewState();
  const { currentTool } = useToolsExplorerState();

  const t = useTranslations('AllToolsView');

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
    return (
      <LoadingEmptyStatusComponent
        emptyMessage={t.rich('ToolsViewerContent.mcpSoon', {
          link: (chunks) => (
            <Link href="https://discord.gg/letta" target="_blank">
              {chunks}
            </Link>
          ),
        })}
        isLoading={false}
      />
    );
  }

  if (category === 'composio') {
    return <ComposioToolsView />;
  }

  return null;
}

export function AllToolsView() {
  const t = useTranslations('AllToolsView');

  return (
    <AllToolsViewStateProvider>
      <HStack fullHeight gap={false}>
        {/* eslint-disable-next-line react/forbid-component-props */}
        <VStack
          color="background-grey"
          className="min-w-[225px] visibleSidebar:flex hidden"
          borderRight
        >
          <HStack padding="medium" borderBottom>
            <Typography bold uppercase variant="body3">
              {t('title')}
            </Typography>
          </HStack>
          <VStack overflowY="auto" paddingX="small" gap="small">
            <ToolCategorySidebar />
          </VStack>
        </VStack>
        <VStack gap={false} fullHeight fullWidth>
          <ToolsViewerContent />
        </VStack>
      </HStack>
    </AllToolsViewStateProvider>
  );
}
