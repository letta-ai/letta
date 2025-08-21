'use client';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { LoggedOutWrapper } from '../../_components/LoggedOutWrapper/LoggedOutWrapper';
import {
  VStack,
  HStack,
  Button,
  DownloadIcon,
  Accordion,
  Typography,
  PythonIcon,
  toast,
  Markdown,
} from '@letta-cloud/ui-component-library';
import agentfileIcon from './agentfile-icon.png';
import { webApi, webApiQueryKeys } from '@letta-cloud/sdk-web';
import { Fragment, useCallback } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import axios from 'axios';
import { trackClientSideEvent } from '@letta-cloud/service-analytics/client';
import { AnalyticsEvent } from '@letta-cloud/service-analytics';

function useAgentId() {
  const params = useParams<{ agentId: string }>();
  return params.agentId;
}

function useCurrentAgent() {
  const agentId = useAgentId();

  const { data } = webApi.agentfile.getAgentfileSummary.useQuery({
    queryData: {
      params: {
        agentId,
      },
    },
    queryKey: webApiQueryKeys.agentfile.getAgentfile(agentId),
  });

  return data?.body;
}

function getToolIcon(toolName: string) {
  switch (toolName) {
    case 'python':
      // eslint-disable-next-line react/forbid-component-props
      return <PythonIcon className="w-4 h-5" />;
    default:
      return null;
  }
}

interface AgentfileContentContainerInterface {
  children: React.ReactNode;
}

function AgentfileContentContainer({
  children,
}: AgentfileContentContainerInterface) {
  return (
    <VStack
      // eslint-disable-next-line react/forbid-component-props
      style={{ maxHeight: '200px', overflowY: 'auto' }}
    >
      {children}
    </VStack>
  );
}

function AgentfileViewer() {
  const agent = useCurrentAgent();
  const agentId = useAgentId();

  const t = useTranslations('agentfiles/page');

  const handleAsyncDownload = useCallback(async () => {
    trackClientSideEvent(AnalyticsEvent.AGENTFILE_DOWNLOAD, {
      agent_id: agentId,
    });

    const downloadURL = `/api/agentfiles/${agentId}/download`;

    if (!agent) {
      return;
    }

    try {
      const response = await axios.get(downloadURL, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));

      const link = document.createElement('a');

      link.href = url;
      link.setAttribute('download', `${agent.name}.af`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (_e) {
      toast.error(t('downloadError'));
    }
  }, [agentId, t, agent]);

  const handleUseInCloudClick = useCallback(() => {
    trackClientSideEvent(AnalyticsEvent.AGENTFILE_USE_IN_LETTA_CLOUD, {
      agent_id: agentId,
    });
    window.open(`/projects?import-agent=${agentId}`, '_blank');
  }, [agentId]);

  if (!agent) {
    return null;
  }

  const { name, author, memory, tools, system, summary, description } = agent;

  return (
    <LoggedOutWrapper
      cardWidth={500}
      showSSOLogin={false}
      showTerms={false}
      showLogo={false}
    >
      <VStack fullWidth fullHeight gap={'xlarge'}>
        <HStack gap={'xlarge'}>
          <div className={'min-w-9'}>
            <Image
              width={36}
              height={48}
              src={agentfileIcon.src}
              alt="agentfile-glyph"
            />
          </div>
          <VStack gap="medium">
            <VStack gap={false}>
              <Typography variant="heading5">{name || t('name')}.af</Typography>
              <Typography variant="large" light>
                {author || t('noAuthor')}
              </Typography>
            </VStack>
            <Typography variant={'large'} light>
              {summary}
            </Typography>
          </VStack>
        </HStack>

        <div className="text-left bg-white border-x border-b">
          <div className="border-t">
            <Accordion
              id="multi-0"
              trigger={t('description')}
              defaultOpen={true}
              theme={'agentfile'}
            >
              <AgentfileContentContainer>
                <Typography variant="body2" light overrideEl="span">
                  {description && <Markdown text={description} />}
                </Typography>
              </AgentfileContentContainer>
            </Accordion>
          </div>
          <div className="border-t">
            <Accordion
              id="multi-1"
              trigger={t('memory')}
              defaultOpen={true}
              theme={'agentfile'}
            >
              <AgentfileContentContainer>
                {memory?.map((memoryBlock, index) => (
                  <Fragment key={index}>
                    <VStack gap={'small'}>
                      <Typography semibold variant={'body2'}>
                        {memoryBlock.label}
                      </Typography>
                      <Typography variant={'body2'} light>
                        {memoryBlock.value}
                      </Typography>
                    </VStack>
                  </Fragment>
                ))}
              </AgentfileContentContainer>
            </Accordion>
          </div>
          <div className="border-t">
            <Accordion id="multi-2" trigger={t('tools')} theme={'agentfile'}>
              <AgentfileContentContainer>
                {tools?.map((tool, index) => (
                  <div key={index}>
                    <VStack gap={'small'}>
                      <HStack align={'center'} gap={'medium'}>
                        <div className={'min-w-4'}>
                          {getToolIcon(tool.source_type)}
                        </div>
                        <Typography variant={'body2'} semibold>
                          {tool.name}
                        </Typography>
                      </HStack>
                      <HStack paddingLeft={'large'}>
                        <HStack paddingLeft={'medium'}>
                          <Typography variant={'body2'} light>
                            {tool.description}
                          </Typography>
                        </HStack>
                      </HStack>
                    </VStack>
                  </div>
                ))}
              </AgentfileContentContainer>
            </Accordion>
          </div>
          <div className="border-t">
            <Accordion id="multi-3" trigger={t('system')} theme="agentfile">
              <AgentfileContentContainer>
                <Typography variant={'body2'} light>
                  {system}
                </Typography>
              </AgentfileContentContainer>
            </Accordion>
          </div>
        </div>
        <VStack fullWidth>
          <Button
            label={t('useInLettaCloud')}
            onClick={handleUseInCloudClick}
            align="center"
            fullWidth
            bold
            size="large"
          />
          <Button
            label={t('downloadAgent')}
            align="center"
            fullWidth
            onClick={handleAsyncDownload}
            bold
            color="tertiary"
            preIcon={<DownloadIcon />}
            size="large"
          />
        </VStack>
      </VStack>
    </LoggedOutWrapper>
  );
}

export default AgentfileViewer;
