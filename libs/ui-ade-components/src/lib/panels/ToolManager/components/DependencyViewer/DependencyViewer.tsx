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
  InfoTooltip,
} from '@letta-cloud/ui-component-library';
import { useState, useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { popularDependencies } from './popularDependencies';
import { DependencyItem } from './DependencyItem';
import type { Dependency } from './types';
import { CustomDependencyForm } from '../CustomDependencyForm/CustomDependencyForm';
import { useStagedCode } from '../../hooks/useStagedCode/useStagedCode';
import { CLOUD_INCLUDED_DEPENDENCIES } from './useManageDependencies/constants';
import { useCurrentAgentMetaData } from '../../../../hooks/useCurrentAgentMetaData/useCurrentAgentMetaData';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

interface DependencyViewerProps {
  tool: Tool;
  onToolUpdate?: (updatedTool: Tool) => void;
}

type FilterOption = 'added' | 'all' | 'not-added';

export function DependencyViewer({ tool }: DependencyViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterOption>('all');
  const { stagedTool } = useStagedCode(tool);
  const { isLocal } = useCurrentAgentMetaData();

  const { data: typescriptToolsEnabled } = useFeatureFlag('TYPESCRIPT_TOOLS');
  
  // Determine if we're working with TypeScript or Python
  const isTypeScript = typescriptToolsEnabled && stagedTool.source_type === 'typescript';

  const addedDependencies = useMemo(() => {
    if (isTypeScript) {
      return new Set(stagedTool.npm_requirements?.map((v) => v.name) || []);
    }
    return new Set(stagedTool.pip_requirements?.map((v) => v.name) || []);
  }, [stagedTool.pip_requirements, stagedTool.npm_requirements, isTypeScript]);

  const filteredRequirements = useMemo(() => {
    const currentRequirements = isTypeScript 
      ? stagedTool.npm_requirements || []
      : stagedTool.pip_requirements || [];
      
    const mergedRequirements = [
      ...currentRequirements,
      ...(!isLocal && !isTypeScript
        ? CLOUD_INCLUDED_DEPENDENCIES.map((v) => ({ ...v, included: true }))
        : []),
    ];

    return mergedRequirements.filter((req) => {
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
  }, [stagedTool.pip_requirements, stagedTool.npm_requirements, isTypeScript, isLocal, searchQuery, filter]);

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

  const t = useTranslations('DependencyViewer');

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
    <VStack color="background" fullWidth fullHeight gap={false}>
      <HStack
        align="center"
        paddingX="small"
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
      <VStack gap={false} fullWidth overflowY="auto" flex>
        <CustomDependencyForm />
        {filteredRequirements.length > 0 && (
          <HStack
            align="center"
            padding="small"
            borderBottom
            color="background-grey"
          >
            <Typography bold variant="body3">
              {t('mine.label')}
            </Typography>
            <InfoTooltip text={t('mine.tooltip')} />
          </HStack>
        )}
        {/* Current Pip Requirements */}
        {filteredRequirements.map((req) => {
          const dependency: Dependency = {
            id: `pip-${req.name}`,
            name: req.name,
            version: req.version || undefined,
            included: 'included' in req,
          };

          return <DependencyItem key={dependency.id} dependency={dependency} />;
        })}
          <>
            <HStack
              align="center"
              padding="small"
              borderBottom
              color="background-grey"
            >
              <Typography bold variant="body3">
                {t('popular')}
              </Typography>
            </HStack>

            {/* Popular Dependencies */}
            {filteredPopularDependencies.map((dependency) => {
              return (
                <DependencyItem key={dependency.id} dependency={dependency} />
              );
            })}
          </>
      </VStack>
    </VStack>
  );
}
