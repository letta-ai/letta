'use client';
import React, { useMemo } from 'react';
import { Button, DataTable } from '@letta-web/component-library';
import type { AgentState } from '@letta-web/letta-agents-api';
import { useAgentsServiceListAgentsApiAgentsGet } from '@letta-web/letta-agents-api';
import type { ColumnDef } from '@tanstack/react-table';

const agentsColumns: Array<ColumnDef<AgentState>> = [
  {
    header: 'Agent Name',
    accessorKey: 'name',
  },
  {
    header: 'Usage',
  },
  {
    id: 'actions',
    header: '',
    meta: {
      style: {
        columnAlign: 'end',
      },
    },
    accessorKey: 'id',
    cell: (cell) => {
      return (
        <Button
          href={`/agents/${cell.getValue()}`}
          color="tertiary"
          label="Visit Agent"
        />
      );
    },
  },
];

export function AgentsTable() {
  const { data, isLoading } = useAgentsServiceListAgentsApiAgentsGet();

  const agents = useMemo(() => {
    return data || [];
  }, [data]);

  return (
    <DataTable
      isLoading={isLoading}
      variant="minimal"
      columns={agentsColumns}
      data={agents}
    />
  );
}
