'use client';
import React, { useCallback, useEffect } from 'react';
import {
  Avatar,
  Button,
  LoadingEmptyStatusComponent,
  DashboardPageLayout,
  HStack,
  PlusIcon,
  Typography,
  Dialog,
  VStack,
  useForm,
  FormField,
  Input,
  FormProvider,
  DashboardPageSection,
  ActionCard,
  RawCodeEditor,
} from '@letta-web/component-library';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useDebouncedValue } from '@mantine/hooks';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ComputerIcon } from 'lucide-react';
import { getIsLocalServiceOnline } from '$letta/client/local-project-manager/getIsLocalServerOnline/getIsLocalServerOnline';
import { LOCAL_PROJECT_SERVER_PORT } from '$letta/constants';

function ConnectToLocalProjectDialog() {
  const t = useTranslations('projects/page');
  const { push } = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const interval = React.useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      interval.current = setInterval(async () => {
        const isOnline = await getIsLocalServiceOnline();

        if (isOnline) {
          push('/local-project/agents');
        }
      }, 3000);
    } else {
      clearInterval(interval.current);
    }

    return () => {
      clearInterval(interval.current);
    };
  }, [open, push]);

  const handleFirstConnect = useCallback(async () => {
    setPending(true);

    const isOnline = await getIsLocalServiceOnline();

    if (isOnline) {
      push('/local-project/agents');
    } else {
      setOpen(true);
    }

    setPending(false);
  }, [push]);

  return (
    <>
      <Button
        onClick={handleFirstConnect}
        preIcon={<ComputerIcon />}
        busy={pending}
        color="tertiary"
        label={t('connectToLocalProject.triggerButton')}
      />
      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        title="Connect to a Local Project"
        hideConfirm
      >
        <Typography>{t('connectToLocalProject.instructions')}</Typography>
        <RawCodeEditor
          fullWidth
          toolbarPosition="bottom"
          label="Command to connect"
          hideLabel
          language="bash"
          code={`letta server --devportal --port=${LOCAL_PROJECT_SERVER_PORT}`}
        />
      </Dialog>
    </>
  );
}

interface ProjectsListProps {
  search: string;
}

const createProjectFormSchema = z.object({
  name: z.string(),
});

function CreateProjectDialog() {
  const [isOpen, setIsOpen] = React.useState(false);
  const t = useTranslations('projects/page');
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

      push(`/projects/${res.body.slug}`);
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
        title={t('createProjectDialog.title')}
        confirmText={t('createProjectDialog.createButton')}
        isOpen={isOpen}
        testId="create-project-dialog"
        onOpenChange={setIsOpen}
        onSubmit={form.handleSubmit(handleSubmit)}
        trigger={
          <Button
            data-testid="create-project-button"
            preIcon={<PlusIcon />}
            color="primary"
            label={t('createProjectDialog.triggerButton')}
          />
        }
      >
        <VStack gap="form">
          <FormField
            render={({ field }) => (
              <Input
                data-testid="project-name-input"
                fullWidth
                {...field}
                label={t('createProjectDialog.nameInput.label')}
              />
            )}
            name="name"
          />
        </VStack>
      </Dialog>
    </FormProvider>
  );
}

function ProjectsList(props: ProjectsListProps) {
  const t = useTranslations('projects/page');
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
      <HStack wrap>
        {data.body.projects.map((project) => (
          <ActionCard
            fullWidthOnMobile
            size="medium"
            key={project.id}
            title={project.name}
            icon={<Avatar name={project.name} />}
          >
            <VStack paddingY="small" rounded>
              <HStack justify="spaceBetween">
                <Typography bold>
                  {t('projectsList.projectItem.agents')}
                </Typography>{' '}
                <Typography>N/A</Typography>
              </HStack>
              <HStack justify="spaceBetween">
                <Typography bold>
                  {t('projectsList.projectItem.totalMessages')}
                </Typography>{' '}
                <Typography>N/A</Typography>
              </HStack>
            </VStack>
            <Button
              color="tertiary"
              align="center"
              fullWidth
              label={t('projectsList.projectItem.viewButton')}
              href={`/projects/${project.slug}`}
            />
          </ActionCard>
        ))}
      </HStack>
    </>
  );
}

function ProjectsPage() {
  const [search, setSearch] = React.useState('');
  const t = useTranslations('projects/page');

  return (
    <DashboardPageLayout
      title={t('title')}
      actions={
        <>
          <ConnectToLocalProjectDialog />
          <CreateProjectDialog />
        </>
      }
    >
      <DashboardPageSection
        searchPlaceholder={t('searchInput.placeholder')}
        searchValue={search}
        onSearch={setSearch}
      >
        <ProjectsList search={search} />
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default ProjectsPage;
