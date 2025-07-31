import {
  ArrowUpwardAltIcon,
  Breadcrumb,
  Button,
  ChevronDownIcon,
  CloseIcon,
  CloseMiniApp,
  HStack,
  PlusIcon,
  Popover,
  VStack,
} from '@letta-cloud/ui-component-library';
import type { BreadcrumbItemType } from '@letta-cloud/ui-component-library';

import React, { useCallback, useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import {
  type NavigationKeys,
  useToolManagerRouteCopy,
} from '../../hooks/useToolManagerRouteCopy/useToolManagerRouteCopy';
import { useToolManagerState } from '../../hooks/useToolManagerState/useToolManagerState';
import { getMatchingRoute, getRouteFromKey } from '../../toolManagerRoutes';

const CATEGORY_KEYS: NavigationKeys[] = [
  'current',
  'customTools',
  'lettaTools',
  'mcpServers',
  'addMCPServers',
];

export function CategoryNavigationDropdown() {
  const details = useToolManagerRouteCopy();
  const { currentPath, setPath } = useToolManagerState();

  const t = useTranslations('AllToolsView');

  const isSubpath = useMemo(() => {
    const matchingRoute = getMatchingRoute(currentPath || '');

    if (!matchingRoute) {
      return false;
    }

    // if path has 2 or more parts, it is a subpath
    return matchingRoute.path.split('/').length > 2;
  }, [currentPath]);

  const rootPathKey = useMemo(() => {
    // find the first part of the path

    const firstPart = currentPath?.split('/')[1];

    const matchingRoute = getMatchingRoute(`/${firstPart}`);

    if (!matchingRoute) {
      return 'current';
    }

    return matchingRoute.key;
  }, [currentPath]);

  const getPathFromKey = useCallback((key: NavigationKeys) => {
    return getRouteFromKey(key)?.path;
  }, []);

  if (isSubpath) {
    return (
      <Button
        label={details[rootPathKey].title as string}
        color="tertiary"
        size="small"
        onClick={() => {
          const nextPath = getPathFromKey(rootPathKey);

          if (nextPath) {
            setPath(nextPath);
          }
        }}
        preIcon={details[rootPathKey].icon}
        postIcon={<ArrowUpwardAltIcon />}
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
          label={details[rootPathKey].title as string}
          color="tertiary"
          fullWidth
          align="left"
          size="small"
          preIcon={details[rootPathKey].icon}
          postIcon={<ChevronDownIcon />}
        />
      }
    >
      <VStack color="background-grey" gap="small">
        {CATEGORY_KEYS.filter((key) => rootPathKey !== key).map((key) => {
          return (
            <HStack key={key} fullWidth>
              <Button
                fullWidth
                align="left"
                size="small"
                label={details[key].title as string}
                color="tertiary"
                preIcon={details[key].icon}
                onClick={() => {
                  const nextPath = getPathFromKey(key);

                  if (nextPath) {
                    setPath(nextPath);
                  }
                }}
              />
            </HStack>
          );
        })}
        <Button
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

interface ToolManagerHeaderProps {
  breadcrumbs?: BreadcrumbItemType[];
}

export function ToolManagerHeader(props: ToolManagerHeaderProps) {
  return (
    <HStack
      height="header-sm"
      align="center"
      justify="spaceBetween"
      paddingX="medium"
      fullWidth
    >
      <HStack gap={false}>
        <Breadcrumb
          size="small"
          items={[
            {
              label: '',
              contentOverride: <CategoryNavigationDropdown />,
            },
            ...(props.breadcrumbs || []),
          ]}
        />
      </HStack>
      <CloseMiniApp data-testid="close-tool-manager">
        <HStack>
          <CloseIcon />
        </HStack>
      </CloseMiniApp>
    </HStack>
  );
}
