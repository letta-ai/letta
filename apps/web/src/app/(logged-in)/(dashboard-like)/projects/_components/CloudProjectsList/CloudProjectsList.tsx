'use client';
import React, { useCallback } from 'react';
import {
  Avatar,
  Button,
  Card,
  LoadingEmptyStatusComponent,
  NiceGridDisplay,
  StarIcon,
  StarFilledIcon,
  Typography,
  HStack,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useDebouncedValue } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from '@letta-cloud/translations';
import { useFormatters } from '@letta-cloud/utils-client';
import {
  webApi,
  type webApiContracts,
  webApiQueryKeys,
  useFeatureFlag,
} from '@letta-cloud/sdk-web';
import type { ServerInferResponses } from '@ts-rest/core';
import { CreateProjectDialog } from '../CreateProjectDialog/CreateProjectDialog';

interface ProjectsListProps {
  search: string;
}

interface ProjectCardProps {
  projectId: string;
  projectName: string;
  lastUpdatedAt?: string;
  url: string;
  isFavorited?: boolean;
  onToggleFavorite?: (projectId: string, isFavorited: boolean) => void;
  showFavoriteButton?: boolean;
}

function ProjectCard(props: ProjectCardProps) {
  const {
    projectId,
    projectName,
    lastUpdatedAt,
    url,
    isFavorited,
    onToggleFavorite,
    showFavoriteButton,
  } = props;
  const t = useTranslations('projects/page/CloudProjectsList');
  const { formatDateAndTime } = useFormatters();

  function handleFavoriteClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(projectId, !isFavorited);
    }
  }

  return (
    <div className="relative">
      {showFavoriteButton && (
        <div
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            zIndex: 10,
          }}
        >
          <Button
            color="tertiary"
            size="small"
            hideLabel
            onClick={handleFavoriteClick}
            preIcon={
              isFavorited ? <StarFilledIcon color="warning" /> : <StarIcon />
            }
            label={
              isFavorited
                ? t('projectsList.projectItem.removeFromFavorites')
                : t('projectsList.projectItem.addToFavorites')
            }
          />
        </div>
      )}
      <Card
        href={url}
        className="w-full flex bg-project-card-background border border-background-grey3-border hover:bg-background-grey2 cursor-pointer">
        <VStack fullWidth>
          <VStack gap="medium" fullWidth>
            <Avatar size="medium" name={projectName} />
            <VStack gap="text">
              <Typography
                bold
                align="left"
                variant="body"
                noWrap
                fullWidth
                overflow="ellipsis"
              >
                {projectName}
              </Typography>
              <HStack>
                {
                  <Typography variant="body" color="muted">
                    {lastUpdatedAt
                      ? t('projectsList.projectItem.lastUpdatedAt', {
                        date: formatDateAndTime(lastUpdatedAt),
                      })
                      : t('projectsList.projectItem.noLastUpdatedAt')}
                  </Typography>
                }
              </HStack>
            </VStack>
          </VStack>
        </VStack>
      </Card>
    </div>
  );
}

export function CloudProjectsList(props: ProjectsListProps) {
  const t = useTranslations('projects/page/CloudProjectsList');
  const [debouncedSearch] = useDebouncedValue(props.search, 500);
  const queryClient = useQueryClient();
  const { data: favoriteProjectsEnabled } = useFeatureFlag('FAVORITE_PROJECTS');

  const { data, isError } = webApi.projects.getProjects.useQuery({
    queryKey: webApiQueryKeys.projects.getProjectsWithSearch({
      search: debouncedSearch,
    }),
    queryData: {
      query: {
        search: debouncedSearch,
      },
    },
  });

  const { mutate: toggleFavorite } =
    webApi.projects.toggleFavoriteProject.useMutation({
      onMutate: async ({ params, body }) => {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({
          queryKey: webApiQueryKeys.projects.getProjects,
        });

        // Snapshot the previous value
        const previousProjects = queryClient.getQueryData(
          webApiQueryKeys.projects.getProjectsWithSearch({
            search: debouncedSearch,
          }),
        );

        // Optimistically update
        queryClient.setQueryData<
          ServerInferResponses<typeof webApiContracts.projects.getProjects, 200>
        >(
          webApiQueryKeys.projects.getProjectsWithSearch({
            search: debouncedSearch,
          }),
          (old) => {
            if (!old?.body?.projects) return old;
            return {
              ...old,
              body: {
                ...old.body,
                projects: old.body.projects.map((p) =>
                  p.id === params.projectId
                    ? { ...p, isFavorited: body.isFavorited }
                    : p,
                ),
              },
            };
          },
        );

        return { previousProjects };
      },
      onError: (_err, _variables, context) => {
        // If the mutation fails, use the context returned from onMutate to roll back
        if (context?.previousProjects) {
          queryClient.setQueryData(
            webApiQueryKeys.projects.getProjectsWithSearch({
              search: debouncedSearch,
            }),
            context.previousProjects,
          );
        }
      },
      onSettled: () => {
        // Always refetch after error or success
        void queryClient.invalidateQueries({
          queryKey: webApiQueryKeys.projects.getProjects,
        });
      },
    });

  const handleToggleFavorite = useCallback(
    (projectId: string, isFavorited: boolean) => {
      toggleFavorite({
        params: { projectId },
        body: { isFavorited },
      });
    },
    [toggleFavorite],
  );

  if (!data || isError || data.body.projects.length === 0) {
    return (
      <LoadingEmptyStatusComponent
        isLoading={!data}
        isError={isError}
        emptyMessage={
          debouncedSearch
            ? t('projectsList.noSearchResults')
            : t('projectsList.noProjects')
        }
        emptyAction={<CreateProjectDialog />}
        loadingMessage="Loading projects..."
      />
    );
  }

  return (
    <>
      <NiceGridDisplay>
        {data.body.projects.map((project) => (
          <ProjectCard
            key={project.id}
            projectId={project.id}
            projectName={project.name}
            lastUpdatedAt={project.updatedAt}
            url={`/projects/${project.slug}`}
            isFavorited={project.isFavorited}
            onToggleFavorite={handleToggleFavorite}
            showFavoriteButton={favoriteProjectsEnabled === true}
          />
        ))}
      </NiceGridDisplay>
    </>
  );
}
