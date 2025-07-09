import type { Tool } from '@letta-cloud/sdk-core';
import {
  Button,
  HStack,
  RawInput,
  SearchIcon,
  Typography,
  VStack,
  CogIcon,
  DropdownMenu,
  DropdownMenuItem,
} from '@letta-cloud/ui-component-library';
import { useState, useCallback } from 'react';
import { useToolsServiceModifyTool } from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import { useFeatureFlag } from '@letta-cloud/sdk-web';
import { popularDependencies } from './popularDependencies';
import { DependencyItem } from './DependencyItem';
import type { Dependency } from './types';

interface DependencyViewerProps {
  tool: Tool;
  onToolUpdate?: (updatedTool: Tool) => void;
}

type FilterOption = 'added' | 'all' | 'not-added';

export function DependencyViewer({ tool }: DependencyViewerProps) {
  const { data: enabled } = useFeatureFlag('DEPENDENCY_VIEWER');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedDependencies, setAddedDependencies] = useState<Set<string>>(
    new Set(),
  );
  const [filter, setFilter] = useState<FilterOption>('all');

  const modifyTool = useToolsServiceModifyTool();
  const t = useTranslations('DependencyViewer');

  const handleAdd = useCallback(
    (dependency: Dependency) => {
      if (!tool.id) {
        console.error('Tool ID is required for updating');
        return;
      }

      // optmistic button
      setAddedDependencies((prev) => new Set(prev).add(dependency.name));

      const currentPipRequirements = tool.pip_requirements || [];
      const dependencyExists = currentPipRequirements.some(
        (req) => req.name === dependency.name,
      );

      if (dependencyExists) {
        console.log(`Dependency ${dependency.name} already exists`);
        console.log(currentPipRequirements);
        return;
      }

      const updatedPipRequirements = [
        ...currentPipRequirements,
        {
          name: dependency.name,
          version: dependency.version,
        },
      ];
      console.log(updatedPipRequirements);

      modifyTool
        .mutateAsync({
          toolId: tool.id,
          requestBody: {
            pip_requirements: updatedPipRequirements,
          },
        })
        .catch((error) => {
          console.error('Mutation failed:', error);
          setAddedDependencies((prev) => {
            const newSet = new Set(prev);
            newSet.delete(dependency.name);
            return newSet;
          });
        });
    },
    [tool.id, tool.pip_requirements, modifyTool],
  );

  if (!enabled) {
    return null;
  }

  function getFilterLabel(filterOption: FilterOption) {
    switch (filterOption) {
      case 'all':
        return t('filter.all');
      case 'added':
        return t('filter.added');
      case 'not-added':
        return t('filter.notAdded');
      default:
        return t('filter.all');
    }
  }

  return (
    <VStack color="background" fullWidth borderLeft fullHeight gap={false}>
      <HStack
        align="center"
        paddingX="medium"
        borderBottom
        height="header-sm"
        fullWidth
        color="background"
        gap="medium"
      >
        <div className="flex-1">
          <RawInput
            hideLabel
            size="small"
            fullWidth
            placeholder={t('search.placeholder')}
            preIcon={<SearchIcon />}
            label={t('search.label')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
            color="transparent"
          />
        </div>
        <DropdownMenu
          trigger={
            <Button
              label={getFilterLabel(filter)}
              size="small"
              color="secondary"
              preIcon={<CogIcon />}
            />
          }
        >
          <DropdownMenuItem
            label={t('filter.all')}
            onClick={() => {
              setFilter('all');
            }}
          />
          <DropdownMenuItem
            label={t('filter.added')}
            onClick={() => {
              setFilter('added');
            }}
          />
          <DropdownMenuItem
            label={t('filter.notAdded')}
            onClick={() => {
              setFilter('not-added');
            }}
          />
        </DropdownMenu>
      </HStack>

      {modifyTool.error ? (
        <HStack
          padding="medium"
          color="destructive"
          borderBottom
          align="center"
          gap="small"
        >
          <Typography variant="body2" color="destructive">
            {t('error.addingDependency')}:{' '}
            {modifyTool.error instanceof Error
              ? modifyTool.error.message
              : typeof modifyTool.error === 'string'
                ? modifyTool.error
                : modifyTool.error &&
                    typeof modifyTool.error === 'object' &&
                    'message' in modifyTool.error
                  ? String(modifyTool.error.message)
                  : t('error.unknown')}
          </Typography>
        </HStack>
      ) : null}

      <VStack gap={false} fullWidth overflowY="auto" flex>
        {popularDependencies
          .filter((dependency) => {
            if (searchQuery.trim()) {
              const query = searchQuery.toLowerCase();
              if (!dependency.name.toLowerCase().includes(query)) {
                return false;
              }
            }

            const isInPipRequirements =
              tool.pip_requirements?.some(
                (req) => req.name === dependency.name,
              ) || false;
            const isAdded =
              addedDependencies.has(dependency.name) || isInPipRequirements;

            switch (filter) {
              case 'added':
                return isAdded;
              case 'not-added':
                return !isAdded;
              case 'all':
              default:
                return true;
            }
          })
          .map((dependency) => {
            const isInPipRequirements =
              tool.pip_requirements?.some(
                (req) => req.name === dependency.name,
              ) || false;
            const isAdded =
              addedDependencies.has(dependency.name) || isInPipRequirements;

            return (
              <DependencyItem
                key={dependency.id}
                dependency={dependency}
                isAdded={isAdded}
                isPending={modifyTool.isPending}
                onAdd={handleAdd}
              />
            );
          })}
      </VStack>
    </VStack>
  );
}
