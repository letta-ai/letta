'use client';
import React from 'react';
import { DashboardHeader } from '$letta/client/common';
import {
  Avatar,
  Button,
  Card,
  DashboardLoader,
  DashboardPageLayout,
  DashboardSearchBar,
  HStack,
  Typography,
  VStack,
} from '@letta-web/component-library';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useDebouncedValue } from '@mantine/hooks';

interface ProjectsListProps {
  search: string;
}

function ProjectsList(props: ProjectsListProps) {
  const [debouncedSearch] = useDebouncedValue(props.search, 500);

  const { data } = webApi.projects.getProjects.useQuery({
    queryKey: webApiQueryKeys.projects.getProjectsWithSearch({
      search: debouncedSearch,
    }),
    queryData: {
      query: {
        search: debouncedSearch,
      },
    },
  });

  if (!data) {
    return <DashboardLoader message="Loading projects..." />;
  }

  return (
    <HStack padding>
      {data.body.projects.map((project) => (
        <Card key={project.id} className="w-[300px] h-[150px]">
          <VStack fullHeight>
            <VStack fullHeight>
              <Avatar name={project.name} />
              <Typography bold>{project.name}</Typography>
            </VStack>
            <Button
              color="tertiary"
              label="View Project"
              fullWidth
              href={`/projects/${project.id}`}
            />
          </VStack>
        </Card>
      ))}
    </HStack>
  );
}

function ProjectsPage() {
  const [search, setSearch] = React.useState('');

  return (
    <DashboardPageLayout
      header={
        <DashboardHeader
          title="Projects"
          actions={
            <>
              <DashboardSearchBar
                searchPlaceholder="Search projects"
                searchValue={search}
                onSearch={setSearch}
              />
              <Button color="primary" label="Create Project" />
            </>
          }
        />
      }
    >
      <ProjectsList search={search} />
    </DashboardPageLayout>
  );
}

export default ProjectsPage;
