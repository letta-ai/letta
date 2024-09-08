'use client';
import React, { useCallback } from 'react';
import { DashboardHeader } from '$letta/client/common';
import {
  Avatar,
  Button,
  Card,
  DashboardStatusComponent,
  DashboardPageLayout,
  DashboardSearchBar,
  HStack,
  PlusIcon,
  Typography,
  Dialog,
  VStack,
  useForm,
  Form,
  FormField,
  Input,
  FormProvider,
} from '@letta-web/component-library';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useDebouncedValue } from '@mantine/hooks';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

interface ProjectsListProps {
  search: string;
}

const createProjectFormSchema = z.object({
  name: z.string(),
});

function CreateProjectDialog() {
  const [isOpen, setIsOpen] = React.useState(false);
  const { push } = useRouter();
  const form = useForm<z.infer<typeof createProjectFormSchema>>({
    resolver: zodResolver(createProjectFormSchema),
    defaultValues: {
      name: '',
    },
  });
  const queryClient = useQueryClient();

  const { mutate } = webApi.projects.createProject.useMutation({
    onSuccess: async (res) => {
      void queryClient.invalidateQueries({
        queryKey: webApiQueryKeys.projects.getProjects,
      });

      push(`/projects/${res.body.id}`);
    },
  });

  const handleSubmit = useCallback(
    (values: z.infer<typeof createProjectFormSchema>) => {
      mutate({
        body: {
          name: values.name,
        },
      });
    },
    [mutate]
  );

  return (
    <FormProvider {...form}>
      <Dialog
        title="Create a project"
        confirmText="Create Project"
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onSubmit={form.handleSubmit(handleSubmit)}
        trigger={
          <Button
            preIcon={<PlusIcon />}
            color="primary"
            label="Create Project"
          />
        }
      >
        <VStack gap="form">
          <FormField
            render={({ field }) => (
              <Input fullWidth {...field} label="Project Name" />
            )}
            name="name"
          />
        </VStack>
      </Dialog>
    </FormProvider>
  );
}

function ProjectsList(props: ProjectsListProps) {
  const [debouncedSearch] = useDebouncedValue(props.search, 500);

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

  if (!data || isError || data.body.projects.length === 0) {
    return (
      <DashboardStatusComponent
        isLoading={!data}
        isError={isError}
        emptyMessage={
          debouncedSearch
            ? "We couldn't find any projects matching your search"
            : 'You have no projects, create one below.'
        }
        emptyAction={<CreateProjectDialog />}
        loadingMessage="Loading projects..."
      />
    );
  }

  return (
    <VStack padding>
      {data.body.projects.map((project) => (
        <Card key={project.id} className="flex-1 h-[150px]">
          <HStack align="center" fullHeight>
            <HStack fullWidth align="center" fullHeight>
              <Avatar name={project.name} />
              <Typography bold>{project.name}</Typography>
            </HStack>
            <Button
              color="tertiary"
              label="View Project"
              href={`/projects/${project.id}`}
            />
          </HStack>
        </Card>
      ))}
    </VStack>
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
              <CreateProjectDialog />
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
