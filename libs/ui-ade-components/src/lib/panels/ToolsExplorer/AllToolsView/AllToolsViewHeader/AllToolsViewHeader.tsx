import {
  type ToolViewerCategory,
  useAllToolsViewState,
} from '../hooks/useAllToolsViewState/useAllToolsViewState';
import { useTranslations } from '@letta-cloud/translations';
import { useToolsExplorerState } from '../../useToolsExplorerState/useToolsExplorerState';
import { useToolCategoryDetails } from '../hooks/useToolCategoryDetails/useToolCategoryDetails';
import React, { useMemo } from 'react';
import {
  ArrowUpwardAltIcon,
  Button,
  ChevronDownIcon,
  HStack,
  PlusIcon,
  Popover,
  VStack,
} from '@letta-cloud/ui-component-library';
import { ToolAppHeader } from '../../ToolAppHeader/ToolAppHeader';

interface ReturnToCategoryButtonProps {
  currentCategory: ToolViewerCategory;
  onReturn: () => void;
}

export function ReturnToCategoryButton(props: ReturnToCategoryButtonProps) {
  const { currentCategory, onReturn } = props;
  const allCategoryDetails = useToolCategoryDetails();

  return (
    <Button
      label={allCategoryDetails[currentCategory].title}
      color="tertiary"
      size="small"
      preIcon={allCategoryDetails[currentCategory].icon}
      postIcon={<ArrowUpwardAltIcon />}
      onClick={() => {
        onReturn();
      }}
    />
  );
}

function CategoryDropdown() {
  const { category, setCategory } = useAllToolsViewState();

  const t = useTranslations('AllToolsView');

  const { startCreateTool, currentTool, clearCurrentTool } =
    useToolsExplorerState();
  const allCategoryDetails = useToolCategoryDetails();

  const currentCategory = useMemo(() => {
    return allCategoryDetails[category];
  }, [category, allCategoryDetails]);

  if (currentTool) {
    return (
      <ReturnToCategoryButton
        currentCategory={category}
        onReturn={() => {
          clearCurrentTool();
        }}
      />
    );
  }

  return (
    <Popover
      align="start"
      triggerAsChild
      className="shadow-lg w-[200px]"
      trigger={
        <Button
          label={currentCategory.title}
          color="tertiary"
          size="small"
          preIcon={currentCategory.icon}
          postIcon={<ChevronDownIcon />}
        />
      }
    >
      <VStack color="background-grey" gap="small">
        {Object.entries(allCategoryDetails)
          .filter(([categoryKey]) => category !== categoryKey)
          .map(([c, details]) => {
            return (
              <HStack key={c} fullWidth>
                <Button
                  fullWidth
                  align="left"
                  size="small"
                  label={details.title}
                  color="tertiary"
                  preIcon={details.icon}
                  onClick={() => {
                    setCategory(c as ToolViewerCategory);
                  }}
                />
              </HStack>
            );
          })}
        <Button
          onClick={() => {
            startCreateTool();
          }}
          fullWidth
          align="left"
          size="small"
          preIcon={<PlusIcon />}
          label={t('ToolCategorySidebar.create')}
          color="primary"
        />
      </VStack>
    </Popover>
  );
}

export function AllToolsViewHeader() {
  return (
    <ToolAppHeader>
      <CategoryDropdown />
    </ToolAppHeader>
  );
}
