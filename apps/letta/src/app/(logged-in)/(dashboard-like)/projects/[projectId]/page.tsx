'use client';

import { DashboardHeader } from '$letta/client/common';
import {
  ActionCard,
  Avatar,
  Button,
  Card,
  DashboardPageLayout,
  DashboardSearchBar,
  HStack,
  RawToggleGroup,
  Typography,
  VStack,
} from '@letta-web/component-library';
import React from 'react';
import { useCurrentProject } from './hooks';
import { ArrowRight } from 'lucide-react';

function ProjectPage() {
  const { name } = useCurrentProject();

  return (
    <DashboardPageLayout
      header={
        <DashboardHeader
          icon={<Avatar name={name} />}
          title={name}
          actions={
            <RawToggleGroup
              value="homepage"
              label="Choose a section"
              hideLabel
              items={[
                {
                  label: 'Project Home',
                  value: 'homepage',
                },
                {
                  label: 'Deployment',
                  value: 'deployment',
                },
                {
                  label: 'Analytics',
                  value: 'analytics',
                },
              ]}
            />
          }
        />
      }
    >
      <VStack borderBottom padding>
        <VStack>
          <HStack align="center" justify="spaceBetween">
            <Typography bold>Recent Testing Agents</Typography>
            <DashboardSearchBar
              onSearch={() => {
                return;
              }}
              searchPlaceholder=""
              searchValue="Search Testing Agents"
            />
          </HStack>
          {new Array(3).fill(0).map((v, index) => (
            <ActionCard
              key={index}
              title={`Agent 423${index}`}
              mainAction={
                <HStack>
                  <Button color="tertiary" label="View / Edit Agent" />
                  <Button color="primary" label="Deploy Agent" />
                </HStack>
              }
            />
          ))}
        </VStack>
      </VStack>
      <VStack borderBottom padding>
        <VStack>
          <HStack align="center" justify="spaceBetween">
            <Typography bold>Deployed Agents</Typography>
            <Button
              color="tertiary"
              postIcon={<ArrowRight />}
              label="See All Deployments"
            />
          </HStack>
          {new Array(3).fill(0).map((v, index) => (
            <Card key={index}>
              <HStack justify="spaceBetween">
                <HStack gap="medium" align="center">
                  <div className="rounded-full bg-green-400 w-[10px] h-[10px]" />
                  <VStack gap={false} justify="start">
                    <Typography align="left" bold>
                      Agent 423{index}
                    </Typography>
                    <Typography color="muted" variant="body2">
                      Deployed 2 days ago
                    </Typography>
                  </VStack>
                </HStack>
                <HStack align="center">
                  <Button color="tertiary" label="See Deployment" />
                </HStack>
              </HStack>
            </Card>
          ))}
        </VStack>
      </VStack>
    </DashboardPageLayout>
  );
}

export default ProjectPage;
