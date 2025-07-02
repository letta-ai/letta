import React from 'react';
import { redirect } from 'next/navigation';
import {
  ArrowUpIcon,
  HStack,
  LettaInvaderOutlineIcon,
} from '@letta-cloud/ui-component-library';
import { getUser } from '$web/server/auth';
import { router } from '$web/web-api/router';
import { ClonePageContent } from './ClonePageContent';

interface ConfirmClonePageProps {
  params: Promise<{
    agentId: string;
  }>;
}

export default async function ConfirmClonePage(props: ConfirmClonePageProps) {
  const { agentId } = await props.params;
  const user = await getUser();

  if (!user) {
    redirect(
      `/login?redirect=${encodeURIComponent(`/agentfiles/${agentId}/clone`)}`,
    );
    return;
  }

  const agentFile = await router.agentfile.getAgentfileSummary({
    params: { agentId },
  });

  if (!agentFile.body || agentFile.status !== 200) {
    redirect('/');
    return;
  }

  return (
    <div className="bg-background-grey3 w-[100dvw] h-[100dvh] overflow-hidden flex items-center justify-center">
      <div className="p-5 shadow-sm bg-background rounded-sm max-w-[400px] mx-auto flex overflow-auto items-center justify-center border">
        <div className="max-w-[350px] flex gap-2 flex-col w-full">
          <HStack gap="small">
            <LettaInvaderOutlineIcon />
            <ArrowUpIcon />
          </HStack>
          <ClonePageContent agentId={agentId} agentName={agentFile.body.name} />
        </div>
      </div>
    </div>
  );
}
