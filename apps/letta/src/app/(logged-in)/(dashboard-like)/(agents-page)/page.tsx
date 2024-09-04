'use client';
import { Button, PlusIcon, VStack } from '@letta-web/component-library';
import { DashboardHeader } from '$letta/client/common';
import { AgentsTable } from './AgentsTable';

function Homepage() {
  return (
    <VStack gap={false} fullWidth fullHeight>
      <DashboardHeader
        title="Agents"
        actions={
          <Button
            color="secondary"
            href="/agents/new"
            size="small"
            label="Create Agent"
            preIcon={<PlusIcon />}
          />
        }
      />
      <AgentsTable />
    </VStack>
  );
}

export default Homepage;
