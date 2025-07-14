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
import { useState, useCallback, useMemo } from 'react';
import {
  useToolsServiceModifyTool,
  UseToolsServiceListToolsKeyFn,
  UseToolsServiceRetrieveToolKeyFn,
} from '@letta-cloud/sdk-core';
import { useTranslations } from '@letta-cloud/translations';
import { useFeatureFlag } from '@letta-cloud/sdk-web';
import { popularDependencies } from './popularDependencies';
import { DependencyItem } from './DependencyItem';
import type { Dependency } from './types';
import { CustomDependencyForm } from '../CustomDependencyForm/CustomDependencyForm';
import { useQueryClient } from '@tanstack/react-query';
import { useStagedCode } from '../../hooks/useStagedCode/useStagedCode';

interface DependencyViewerProps {
  tool: Tool;
  onToolUpdate?: (updatedTool: Tool) => void;
}

type FilterOption = 'added' | 'all' | 'not-added';

export function DependencyViewer({ tool }: DependencyViewerProps) {
  const { data: enabled } = useFeatureFlag('DEPENDENCY_VIEWER');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [pendingDependency, setPendingDependency] = useState<string | null>(
    null,
  );

  const queryClient = useQueryClient();
  const { stagedTool, setStagedTool } = useStagedCode(tool);

  const addedDependencies = useMemo(() => {
    return new Set(stagedTool.pip_requirements?.map((v) => v.name) || []);
  }, [stagedTool.pip_requirements]);

  const filteredRequirements = useMemo(() => {
    return (stagedTool.pip_requirements || []).filter((req) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!req.name.toLowerCase().includes(query)) {
          return false;
        }
      }

      const isAdded = true;

      switch (filter) {
        case 'added':
          return isAdded;
        case 'not-added':
          return false;
        case 'all':
        default:
          return true;
      }
    });
  }, [stagedTool.pip_requirements, searchQuery, filter]);

  const filteredPopularDependencies = useMemo(() => {
    return popularDependencies.filter((dependency) => {
      const isInPipRequirements = addedDependencies.has(dependency.name);

      if (isInPipRequirements) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!dependency.name.toLowerCase().includes(query)) {
          return false;
        }
      }

      const isAdded = isInPipRequirements;

      switch (filter) {
        case 'added':
          return isAdded;
        case 'not-added':
          return !isAdded;
        case 'all':
        default:
          return true;
      }
    });
  }, [addedDependencies, searchQuery, filter]);

  const modifyTool = useToolsServiceModifyTool({
    onSuccess: (response) => {
      queryClient.setQueriesData<Tool[] | undefined>(
        {
          queryKey: UseToolsServiceListToolsKeyFn(),
          exact: false,
        },
        (old) => {
          if (!old) {
            return old;
          }

          return old.map((t) => {
            if (t.id === tool.id) {
              return response;
            }

            return t;
          });
        },
      );

      queryClient.setQueriesData<Tool | undefined>(
        {
          queryKey: UseToolsServiceRetrieveToolKeyFn({ toolId: tool.id || '' }),
        },
        () => response,
      );
      setStagedTool(() => response);
      setPendingDependency(null);
    },
    onError: () => {
      setPendingDependency(null);
    },
  });

  const t = useTranslations('DependencyViewer');

  const handleAdd = useCallback(
    (dependency: Dependency) => {
      if (!stagedTool.id) {
        return;
      }

      const currentPipRequirements = stagedTool.pip_requirements || [];
      const dependencyExists = currentPipRequirements.some(
        (req) => req.name === dependency.name,
      );

      if (dependencyExists) {
        return;
      }

      const updatedPipRequirements = [
        ...currentPipRequirements,
        {
          name: dependency.name,
          ...(dependency.version && { version: dependency.version }),
        },
      ];

      setPendingDependency(dependency.name);
      modifyTool.mutate({
        toolId: stagedTool.id,
        requestBody: {
          pip_requirements: updatedPipRequirements,
        },
      });
    },
    [stagedTool.id, stagedTool.pip_requirements, modifyTool],
  );

  const handleAddCustomDependency = useCallback(
    (dependency: { name: string; version?: string }) => {
      const customDependency: Dependency = {
        id: `custom-${dependency.name}`,
        name: dependency.name.trim(),
        version: dependency.version?.trim() || undefined,
        description: 'Custom dependency',
      };

      handleAdd(customDependency);
    },
    [handleAdd],
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
        <HStack flex>
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
        </HStack>
        <DropdownMenu
          triggerAsChild
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
        <CustomDependencyForm onSubmit={handleAddCustomDependency} />

        {/* Current Pip Requirements */}
        {filteredRequirements.map((req) => {
          const dependency: Dependency = {
            id: `pip-${req.name}`,
            name: req.name,
            version: req.version || undefined,
            description: t('description.pipPackage'),
          };

          return (
            <DependencyItem
              key={dependency.id}
              dependency={dependency}
              isAdded={true}
              isPending={pendingDependency === dependency.name}
              onAdd={handleAdd}
            />
          );
        })}

        {/* Popular Dependencies */}
        {filteredPopularDependencies.map((dependency) => {
          const isAdded = addedDependencies.has(dependency.name);

          return (
            <DependencyItem
              key={dependency.id}
              dependency={dependency}
              isAdded={isAdded}
              isPending={pendingDependency === dependency.name}
              onAdd={handleAdd}
            />
          );
        })}
      </VStack>
    </VStack>
  );
}
