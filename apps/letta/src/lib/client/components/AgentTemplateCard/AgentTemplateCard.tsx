import React from 'react';
import { useTranslations } from 'next-intl';
import { useCurrentProject } from '../../../../app/(logged-in)/(dashboard-like)/projects/[projectSlug]/hooks';
import {
  ActionCard,
  Avatar,
  Button,
  HStack,
} from '@letta-web/component-library';
import { useDateFormatter } from '@letta-web/helpful-client-utils';
import type { AgentTemplateType } from '$letta/web-api/agent-templates/agentTemplatesContracts';

interface AgentTemplateCardProps {
  agent: AgentTemplateType;
}

export function AgentTemplateCard(props: AgentTemplateCardProps) {
  const t = useTranslations('components/AgentTemplateCard');
  // const [openVersions, setOpenVersions] = React.useState(false);
  const { agent } = props;
  const { name, updatedAt } = agent;
  const { formatDate } = useDateFormatter();
  const { slug: projectSlug } = useCurrentProject();

  return (
    <ActionCard
      icon={<Avatar size="small" name={name} />}
      title={name}
      subtitle={t('subtitle', {
        date: formatDate(updatedAt),
      })}
      mainAction={
        <HStack>
          {/*{versions && (*/}
          {/*    <Button*/}
          {/*      onClick={() => setOpenVersions(v => !v)}*/}
          {/*      color="tertiary-transparent"*/}
          {/*      label={t('versions', {*/}
          {/*      count: versions.length,*/}
          {/*    })} />*/}
          {/*  )}*/}
          <Button
            href={`/projects/${projectSlug}/templates/${name}`}
            color="tertiary"
            label={t('openInADE')}
          />
        </HStack>
      }
    >
      {/*{openVersions && (*/}
      {/*  <VStack padding rounded color="background-grey">*/}
      {/*    {versions?.map((version) => (*/}
      {/*      <HStack fullWidth align="center" key={version.version} justify="spaceBetween">*/}
      {/*        <HStack fullWidth align="center">*/}
      {/*          <div><Badge content={version.version} color="primary" /></div>*/}
      {/*          <RawInput color="transparent" fullWidth hideLabel label={t('versionList.copyVersion')} value={`${name}:${version.version}`} allowCopy />*/}
      {/*        </HStack>*/}
      {/*        <Typography>{t('versionList.createdAt', { date: nicelyFormattedDateAndTime(version.updatedAt) })}</Typography>*/}
      {/*      </HStack>*/}
      {/*    ))}*/}
      {/*  </VStack>*/}
      {/*)}*/}
    </ActionCard>
  );
}
