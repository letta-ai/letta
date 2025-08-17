'use client';
import React, { useMemo, useState } from 'react';
import type { OptionType } from '@letta-cloud/ui-component-library';
import { ActionCard, Avatar, HStack } from '@letta-cloud/ui-component-library';
import { PlusIcon } from '@letta-cloud/ui-component-library';
import {
  Button,
  DashboardPageLayout,
  DashboardPageSection,
  LoadingEmptyStatusComponent,
  VStack,
  RawInput,
} from '@letta-cloud/ui-component-library';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import { useDebouncedValue } from '@mantine/hooks';
import { SearchIcon } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { CreateNewTemplateDialog } from '../_components/CreateNewTemplateDialog/CreateNewTemplateDialog';
import { cloudAPI, cloudQueryKeys } from '@letta-cloud/sdk-cloud-api';

const PAGE_SIZE = 20;

interface ProjectStagingListProps {
  search: string;
  filterBy?: OptionType;
}

function AgentTemplateList(props: ProjectStagingListProps) {
  const { id: currentProjectId } = useCurrentProject();
  const t = useTranslations('projects/(projectSlug)/templates/page');
  const { search } = props;

  const { data, isLoading, fetchNextPage, hasNextPage } =
    cloudAPI.templates.listTemplates.useInfiniteQuery({
      queryKey: cloudQueryKeys.templates.infiniteListTemplatesProjectScopedWithSearch(currentProjectId, {
        search,
      }),
      queryData: ({ pageParam }) => ({
        query: {
          search,
          project_id: currentProjectId,
          offset: pageParam.offset.toString(),
          limit: pageParam.limit.toString(),
        },
      }),
      initialPageParam: { offset: 0, limit: PAGE_SIZE },
      getNextPageParam: (lastPage, allPages) => {
        return lastPage.body.has_next_page
          ? { limit: PAGE_SIZE, offset: allPages.length * PAGE_SIZE }
          : undefined;
      },
    });


  const deployedAgentTemplates = useMemo(() => {
    return (data?.pages || []).flatMap((v) => v.body.templates);
  }, [data]);

  if (deployedAgentTemplates.length === 0) {
    return (
      <LoadingEmptyStatusComponent
        emptyMessage={!search ? t('noTemplates') : t('noTemplatesFound')}
        emptyAction={
          <CreateNewTemplateDialog
            trigger={
              <Button preIcon={<PlusIcon />} label={t('createTemplate')} />
            }
          />
        }
        isLoading={isLoading}
      />
    );
  }



  return (
    <>
      {deployedAgentTemplates.map((template) => (
        <ActionCard
          key={template.id}
          icon={<Avatar size="small" name={template.name} />}
          title={template.name}
          subtitle={template.description}
          mainAction={
            <HStack>
              <Button
                href={`/projects/${template.project_slug}/templates/${template.name}`}
                color="secondary"
                label={t('openInADE')}
              />
            </HStack>
          }
        >
        </ActionCard>
      ))}
      {hasNextPage && (
        <Button
          fullWidth
          color="primary"
          label={t('loadMore')}
          onClick={() => {
            void fetchNextPage();
          }}
        />
      )}
    </>
  );
}

function TemplatesPage() {
  const [search, setSearch] = useState<string>('');
  const t = useTranslations('projects/(projectSlug)/templates/page');

  const [debouncedSearch] = useDebouncedValue(search, 500);

  return (
    <DashboardPageLayout
      title={t('title')}
      actions={
        <CreateNewTemplateDialog
          trigger={
            <Button
              color="primary"
              preIcon={<PlusIcon />}
              label={t('createTemplate')}
            />
          }
        />
      }
    >
      <DashboardPageSection>
        <VStack fullHeight fullWidth>
          <VStack gap={false} fullWidth>
            <RawInput
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              value={search}
              preIcon={<SearchIcon />}
              hideLabel
              label={t('searchInput.label')}
              placeholder={t('searchInput.placeholder')}
              fullWidth
            />
          </VStack>
          <AgentTemplateList search={debouncedSearch} />
        </VStack>
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default TemplatesPage;
