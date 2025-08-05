'use client';

import React from 'react';
import { webApi, webApiQueryKeys } from '$web/client';
import { useTranslations } from '@letta-cloud/translations';
import {
  Button,
  PlusIcon,
  toast,
  useForm,
} from '@letta-cloud/ui-component-library';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { uuid4 } from '@temporalio/workflow';
import { useCurrentProject } from '$web/client/hooks/useCurrentProject/useCurrentProject';
import type { ServerInferResponses } from '@ts-rest/core';
import type { AbTestType, contracts } from '@letta-cloud/sdk-web';
import { useCurrentOrganization } from '$web/client/hooks';

const createAbTestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
});

type CreateAbTestFormValues = z.infer<typeof createAbTestSchema>;

export const createAbTestMutationKey = ['createABTest'];

export function CreateABTest() {
  const { id: projectId, slug: projectSlug } = useCurrentProject();

  const currentOrg = useCurrentOrganization();
  const queryClient = useQueryClient();
  const t = useTranslations('projects/ab-tests.CreateABTest');

  const form = useForm<CreateAbTestFormValues>({
    resolver: zodResolver(createAbTestSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const { mutate, isPending, isSuccess } =
    webApi.abTest.createAbTest.useMutation({
      mutationKey: createAbTestMutationKey,
      onMutate: async (variables) => {
        await queryClient.cancelQueries({
          queryKey: webApiQueryKeys.abTest.getAbTestsWithSearch(projectId),
        });

        const { name, description, uuid = '' } = variables.body;

        const nextSchema: AbTestType = {
          id: uuid || '',
          name: name || '',
          organizationId: currentOrg?.id || '',
          description: description || '',
          projectId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const previousData = queryClient.getQueryData<
          ServerInferResponses<typeof contracts.abTest.getAbTests, 200>
        >(webApiQueryKeys.abTest.getAbTestsWithSearch(projectId));

        queryClient.setQueryData<
          ServerInferResponses<typeof contracts.abTest.getAbTests, 200>
        >(webApiQueryKeys.abTest.getAbTestsWithSearch(projectId), (oldData) => {
          if (!oldData) {
            return oldData;
          }

          return {
            ...oldData,
            body: {
              ...oldData.body,
              abTests: [...oldData.body.abTests, nextSchema],
            },
          };
        });

        queryClient.setQueryData<
          ServerInferResponses<typeof contracts.abTest.getAbTest, 201>
        >(webApiQueryKeys.abTest.getAbTest(uuid), () => ({
          status: 201,
          body: nextSchema,
        }));

        // Return a context object with the previous data

        return { previousData };
      },

      onSuccess: () => {
        // Invalidate the query to refresh the data
        void queryClient.invalidateQueries({
          queryKey: webApiQueryKeys.abTest.getAbTestsWithSearch(projectId),
          exact: false,
        });
        form.reset();
      },
      onError: (_e, _v, context) => {
        // Rollback to the previous data in case of error
        if (context?.previousData) {
          queryClient.setQueryData<
            ServerInferResponses<typeof contracts.abTest.getAbTests, 200>
          >(
            webApiQueryKeys.abTest.getAbTestsWithSearch(projectId),
            context.previousData,
          );
        }

        toast.error(t('error'));

        // push back to the previous page
        router.push(`/projects/${projectSlug}/ab-tests`);
      },
    });

  const router = useRouter();

  function onSubmit() {
    const uuid = uuid4();

    router.push(`/projects/${projectSlug}/ab-tests/${uuid}`);

    const name = 'My AB test';
    const description = 'A test between two templates...';

    mutate({
      body: {
        name,
        description,
        uuid,
        projectId,
      },
    });
  }

  return (
    <Button
      disabled={isPending || isSuccess}
      size="small"
      onClick={onSubmit}
      label={t('trigger')}
      preIcon={<PlusIcon />}
    />
  );
}
