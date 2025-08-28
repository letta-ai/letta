'use client';
import React, { useMemo } from 'react';
import {
  AsyncSelect, isMultiValue,
  type OptionType
} from '@letta-cloud/ui-component-library';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { useTranslations } from '@letta-cloud/translations';
import { z } from 'zod';


function useProjects() {
  const { data, isLoading } = webApi.projects.getProjects.useQuery({
    queryKey: webApiQueryKeys.projects.getProjectsWithSearch({}),
    queryData: {
      query: {},
    },
  });

  return { data, isLoading };
}

export const ProjectSelectorProjectSchema = z.object({
  name: z.string(),
  id: z.string(),
  slug: z.string(),
})

export type ProjectSelectorProjectType = z.infer<typeof ProjectSelectorProjectSchema>;

interface ImportAgentFileProjectSelectorProps {
  fullWidth?: boolean;
  value: ProjectSelectorProjectType
  onSelectProject: (project: ProjectSelectorProjectType) => void;
}


export function ImportAgentFileProjectSelector(props: ImportAgentFileProjectSelectorProps) {
  const {
    value,
    fullWidth = true,
    onSelectProject,
  } = props;
  const t = useTranslations('ImportAgentFileProjectSelector/ProjectSelector');
  const { data: projectsData, isLoading } = useProjects();

  const projectOptions = React.useMemo(() => {
    return (projectsData?.body?.projects || []).map((project) => ({
      value: project.id,
      label: project.name,
      data: {
        slug: project.slug,
      }
    }));
  }, [projectsData]);


  const loadOptions = async () => {
    const response = await webApi.projects.getProjects.query({

    });

    if (response.status !== 200) {
      return []
    }

    const projects = response?.body?.projects || [];
    return projects.map((project) => ({
      value: project.id,
      label: project.name,
      data: {
        slug: project.slug,
      }
    }));
  };

  const optionValue: OptionType | undefined = useMemo(() => {
    if (!value) {
      return undefined;
    }

    return {
      value: value.slug,
      label: value.name,
      data: {
        slug: value.slug,
      }
    }
  }, [value])

  return (
    <AsyncSelect
      label={ t('label')}
      loadOptions={loadOptions}
      value={optionValue}
      onSelect={(selectedOption) => {
        if (!selectedOption || isMultiValue(selectedOption)) {
          return;
        }

        onSelectProject({
          id: selectedOption.value || '',
          name: selectedOption.label,
          slug: selectedOption.data?.slug || ''
        })
      }}
      fullWidth={fullWidth}
      defaultOptions={projectOptions}
      cacheOptions
      isLoading={isLoading}
    />
  );
}
