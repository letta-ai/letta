import React, { useCallback, useMemo } from 'react';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useCurrentProject } from '../../../../app/(logged-in)/(dashboard-like)/projects/[projectSlug]/hooks';
import {
  Button,
  Popover,
  ProgressBar,
  Typography,
  UnfoldIcon,
  VStack,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';

interface ProjectItemProps {
  name: string;
  isCurrent?: boolean;
  onClick: () => void;
  slug: string;
}

function ProjectItem(props: ProjectItemProps) {
  const { name, onClick, isCurrent, slug } = props;

  return (
    <Button
      align="left"
      onClick={onClick}
      active={isCurrent}
      color="tertiary-transparent"
      size="small"
      fullWidth
      href={`/projects/${slug}`}
      label={name}
    />
  );
}
const LIMIT = 5;

export function ProjectSelector() {
  const [open, setOpen] = React.useState(false);
  const t = useTranslations('components/ProjectSelector');

  const currentProject = useCurrentProject();
  const { data, isLoading } = webApi.projects.getProjects.useQuery({
    queryKey: webApiQueryKeys.projects.getProjectsWithSearch({
      limit: LIMIT,
    }),
    queryData: {
      query: {
        limit: LIMIT,
      },
    },
  });

  const projectsList = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.body.projects.filter(
      (project) => project.id !== currentProject.id
    );
  }, [currentProject.id, data]);

  const handleClickProject = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <Popover
      open={open}
      align="start"
      onOpenChange={setOpen}
      trigger={
        <Button
          color="tertiary-transparent"
          postIcon={<UnfoldIcon />}
          size="small"
          label={currentProject?.name || t('selectAProject')}
        />
      }
    >
      <VStack padding="small">
        <Typography bold variant="body2">
          {t('projects')}
        </Typography>
        <ProjectItem
          isCurrent
          onClick={handleClickProject}
          name={currentProject.name}
          slug={currentProject.slug}
        />
        {isLoading && <ProgressBar indeterminate />}
        {projectsList.map((project) => (
          <ProjectItem
            key={project.id}
            onClick={handleClickProject}
            name={project.name}
            slug={project.slug}
          />
        ))}
        {!isLoading && projectsList.length >= LIMIT - 1 && (
          <Button
            color="tertiary"
            size="small"
            fullWidth
            href="/projects"
            label={t('seeMore')}
          />
        )}
      </VStack>
    </Popover>
  );
}
