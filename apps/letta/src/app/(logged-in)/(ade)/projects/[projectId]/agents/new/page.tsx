'use client';
import React, { useCallback } from 'react';
import {
  ADEHeader,
  ADEPage,
  ArrowLeftIcon,
  Button,
  Card,
  HStack,
  LettaLoader,
  Typography,
  VStack,
} from '@letta-web/component-library';
import { useCurrentProjectId } from '../../../../../(dashboard-like)/projects/[projectId]/hooks';
import { webApi, webApiQueryKeys } from '$letta/client';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AgentTemplateVariant } from '$letta/types';

interface AgentRecipeCardProps {
  name: string;
  id: string;
  onClick?: () => void;
}

function AgentRecipeCard(props: AgentRecipeCardProps) {
  const { name, onClick, id } = props;

  return (
    <button
      className="aspect-auto w-full max-w-[33%] w-fit h-fit"
      onClick={onClick}
      data-testid={`agent-recipe-card-${id}`}
    >
      <Card className=" hover:bg-tertiary-hover ">
        <VStack align="center">
          <div className="bg-gray-100 w-[150px] h-[150px]" />
          <Typography bold variant="heading2">
            {name}
          </Typography>
        </VStack>
      </Card>
    </button>
  );
}

function CreateAgentsView() {
  const projectId = useCurrentProjectId();
  const queryClient = useQueryClient();
  const { push } = useRouter();

  const {
    mutate: createTestingAgent,
    isPending,
    isSuccess,
  } = webApi.projects.createProjectTestingAgent.useMutation({
    onSuccess: (response) => {
      void queryClient.invalidateQueries({
        queryKey: webApiQueryKeys.projects.getProjectTestingAgents(projectId),
      });

      push(`/projects/${projectId}/agents/${response.body.id}`);
    },
  });

  const handleCreateAgent = useCallback(
    (recipeId: AgentTemplateVariant) => {
      createTestingAgent({
        body: {
          recipeId,
        },
        params: { projectId },
      });
    },
    [projectId, createTestingAgent]
  );

  if (isPending || isSuccess) {
    return (
      <VStack gap="large" align="center" justify="center" fullWidth fullHeight>
        <LettaLoader size="large" />
        Creating agent...
      </VStack>
    );
  }

  return (
    <VStack gap={false} fullWidth align="start" justify="center">
      <Typography bold variant="heading1">
        Create a New Agent
      </Typography>
      <Typography variant="body">
        Create an agent by selecting the following recipes
      </Typography>
      <VStack paddingTop align="center">
        <HStack>
          <AgentRecipeCard
            name="Customer Support"
            id={AgentTemplateVariant.CUSTOMER_SUPPORT}
            onClick={() => {
              handleCreateAgent(AgentTemplateVariant.CUSTOMER_SUPPORT);
            }}
          />
          <AgentRecipeCard
            name="Data Collector"
            id={AgentTemplateVariant.DATA_COLLECTOR}
            onClick={() => {
              handleCreateAgent(AgentTemplateVariant.DATA_COLLECTOR);
            }}
          />
          <AgentRecipeCard
            name="Fantasy Roleplay"
            id={AgentTemplateVariant.FANTASY_ROLEPLAY}
            onClick={() => {
              handleCreateAgent(AgentTemplateVariant.FANTASY_ROLEPLAY);
            }}
          />
        </HStack>
        <Button
          size="small"
          color="tertiary-transparent"
          label="or start from scratch"
          onClick={() => {
            handleCreateAgent(AgentTemplateVariant.DEFAULT);
          }}
        />
      </VStack>
    </VStack>
  );
}

function NewAgentPage() {
  const projectId = useCurrentProjectId();

  return (
    <ADEPage
      header={
        <ADEHeader>
          <Button
            color="black"
            href={`/projects/${projectId}`}
            label="Back to Project"
            preIcon={<ArrowLeftIcon />}
          />
        </ADEHeader>
      }
    >
      <VStack fullHeight fullWidth align="center" justify="center">
        <HStack
          align="center"
          justify="center"
          className="max-w-[600px] max-h-[350px]"
          fullHeight
          fullWidth
          paddingY="large"
          paddingX="large"
          border
          rounded
          color="background"
        >
          <CreateAgentsView />
        </HStack>
      </VStack>
    </ADEPage>
  );
}

export default NewAgentPage;
