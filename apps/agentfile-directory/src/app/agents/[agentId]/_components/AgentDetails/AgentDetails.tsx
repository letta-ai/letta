'use client';
import type { GetAgentFileDetails } from '@letta-cloud/sdk-web';
import {
  BlockViewer,
  BoltIcon,
  HStack,
  Markdown,
  RawKeyValueEditor,
  TabGroup,
  ToolLanguageIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { CenterContent } from '../../../../../lib/client/components/CenterContent/CenterContent';
import { createContext, useContext, useMemo, useState } from 'react';
import { ToolRulesVisual } from '@letta-cloud/ui-ade-components';
import type { AgentState } from '@letta-cloud/sdk-core';
import { cn } from '@letta-cloud/ui-styles';
import { useFormatters } from '@letta-cloud/utils-client';
import './AgentDetails.scss';

interface AgentDetailsProps {
  agent: GetAgentFileDetails;
}

type Tabs =
  | 'memoryBlocks'
  | 'overview'
  | 'toolRules'
  | 'tools'
  | 'toolVariables';

interface TabberProps {
  value: Tabs;
  onChange: (value: Tabs) => void;
}

function Tabber(props: TabberProps) {
  const { value, onChange } = props;
  const t = useTranslations('pages/agent/AgentHeader.tabs');

  return (
    <TabGroup
      value={value}
      onValueChange={(value) => {
        onChange(value as Tabs);
      }}
      size="large"
      color="transparent"
      items={[
        {
          label: t('overview'),
          value: 'overview',
        },
        {
          label: t('memoryBlocks'),
          value: 'memoryBlocks',
        },
        {
          label: t('tools'),
          value: 'tools',
        },
        {
          label: t('toolVariables'),
          value: 'toolVariables',
        },
      ]}
    />
  );
}

interface AgentOverviewProps {
  agent: GetAgentFileDetails;
}

function AgentOverview(props: AgentOverviewProps) {
  const { agent } = props;
  const { description, system, memory, tools } = agent;
  const t = useTranslations('components/AgentDetails');

  const { setValue } = useSelectedTab();

  return (
    <>
      <CappedWidth>
        {description && <Markdown text={description} />}
      </CappedWidth>
      <CappedWidth>
        <BlockViewer
          title={t('memoryBlocks')}
          limit={2}
          onSeeAll={() => {
            setValue('memoryBlocks');
          }}
          maxLines={2}
          elements={memory.map((block) => ({
            label: block.label,
            value: block.value,
          }))}
        />
      </CappedWidth>
      <CappedWidth>
        <BlockViewer
          limit={3}
          onSeeAll={() => {
            setValue('tools');
          }}
          title={t('tools')}
          elements={tools.map((tool) => ({
            label: tool.name,
            value: tool.description || '',
            icon: <ToolLanguageIcon sourceType={tool.source_type} />,
          }))}
        />
      </CappedWidth>
      <ToolRules agent={agent} />
      <CappedWidth>
        <BlockViewer
          title={t('system')}
          maxLines={4}
          elements={[
            {
              value: system,
            },
          ]}
        />
      </CappedWidth>
      <CappedWidth>
        <ToolVariables agent={agent} />
      </CappedWidth>
    </>
  );
}

interface ToolVariablesProps {
  agent: GetAgentFileDetails;
}

function ToolVariables(props: ToolVariablesProps) {
  const { agent } = props;
  const t = useTranslations('components/AgentDetails');

  const parsedVariables = useMemo(() => {
    return (
      agent.toolVariables?.map((key) => ({
        key: key.name,
        value: '',
      })) || []
    );
  }, [agent.toolVariables]);

  return (
    <VStack>
      <Typography bold>{t('variables')}</Typography>
      {parsedVariables.length > 0 ? (
        <RawKeyValueEditor
          hideLabel
          label={t('variables')}
          value={parsedVariables}
          disabled
        />
      ) : (
        <Typography italic>{t('noVariables')}</Typography>
      )}
    </VStack>
  );
}

interface ToolRulesProps {
  agent: GetAgentFileDetails;
}

function ToolRules(props: ToolRulesProps) {
  const { agent } = props;
  const t = useTranslations('components/AgentDetails');

  return (
    <VStack>
      <HStack align="center">
        <Typography bold>{t('toolRules')}</Typography>
        <div className="border flex items-center justify-center w-[22px] h-[22px]">
          <Typography variant="body2" bold>
            {(agent.toolRules || []).length}
          </Typography>
        </div>
      </HStack>
      <VStack
        /* eslint-disable-next-line react/forbid-component-props */
        className="h-[600px] mx-auto rounded "
        border
        overflow="hidden"
        fullHeight
        fullWidth
      >
        <ToolRulesVisual
          tools={agent.tools}
          toolRules={agent.toolRules as AgentState['tool_rules'] | undefined}
        />
      </VStack>
    </VStack>
  );
}

interface SwitcherProps {
  selectedTab: Tabs;
  agent: GetAgentFileDetails;
}

function Switcher(props: SwitcherProps) {
  const { selectedTab, agent } = props;

  switch (selectedTab) {
    case 'overview':
      return <AgentOverview agent={agent} />;
    case 'memoryBlocks':
      return (
        <CappedWidth>
          <BlockViewer
            title="Memory Blocks"
            elements={agent.memory.map((block) => ({
              label: block.label,
              value: block.value,
            }))}
          />
        </CappedWidth>
      );
    case 'tools':
      return (
        <CappedWidth>
          <BlockViewer
            title="Tools"
            elements={agent.tools.map((tool) => ({
              label: tool.name,
              value: tool.description,
              icon: <ToolLanguageIcon sourceType={tool.source_type} />,
            }))}
          />
        </CappedWidth>
      );
    case 'toolVariables':
      return (
        <CappedWidth>
          <ToolVariables agent={agent} />
        </CappedWidth>
      );
    default:
      return null;
  }
}

const SelectedTabContext = createContext<{
  value: Tabs;
  setValue: (value: Tabs) => void;
}>({
  value: 'overview',
  setValue: () => {
    return;
  },
});

interface DetailProps {
  label: string;
  value: React.ReactNode;
}

function Detail(props: DetailProps) {
  const { label, value } = props;
  return (
    <VStack gap="small" fullWidth>
      <Typography variant="body3" light color="lighter">
        {label}
      </Typography>
      <Typography variant="body3" overrideEl="span">
        {value}
      </Typography>
    </VStack>
  );
}

interface DetailsOverlayProps {
  agent: GetAgentFileDetails;
}

function DetailsOverlay(props: DetailsOverlayProps) {
  const t = useTranslations('components/AgentDetails.DetailsOverlay');
  const { formatDate, formatPercentage, formatShorthandNumber } =
    useFormatters();

  const { agent } = props;

  const { author, publishedAt, downloadCount, upvotes, downvotes } = agent;

  const rating = useMemo(() => {
    if (upvotes + downvotes === 0) {
      return (
        <Typography variant="body2" italic>
          {t('noRating')}
        </Typography>
      );
    }

    const totalVotes = upvotes + downvotes;

    const ratingValue = (upvotes / totalVotes) * 100;

    return formatPercentage(ratingValue, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }, [upvotes, downvotes, formatPercentage, t]);

  return (
    <VStack gap="xlarge" padding border>
      <HStack>
        <Detail label={t('distributor')} value={author} />
        <Detail label={t('published')} value={formatDate(publishedAt)} />
      </HStack>
      <HStack>
        <Detail
          label={t('downloads')}
          value={
            <HStack gap="small">
              <BoltIcon size="xsmall" />
              {formatShorthandNumber(downloadCount)}
            </HStack>
          }
        />
        <Detail label={t('rating')} value={rating} />
      </HStack>
    </VStack>
  );
}

function CappedWidth({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[560px] w-full">{children}</div>;
}

function useSelectedTab() {
  const context = useContext(SelectedTabContext);
  if (!context) {
    throw new Error('useSelectedTab must be used within a SelectedTabContext');
  }
  return context;
}

export function AgentDetails(props: AgentDetailsProps) {
  const { agent } = props;

  const [selectedTab, setSelectedTab] = useState<Tabs>('overview');

  return (
    <SelectedTabContext
      value={{
        value: selectedTab,
        setValue: setSelectedTab,
      }}
    >
      <CenterContent>
        <div className="relative w-full">
          <div className="pt-[24px]">
            <Tabber
              value={selectedTab}
              onChange={(value) => {
                setSelectedTab(value);
              }}
            />
          </div>
          <div className={cn('gap-[32px]  py-[32px] flex flex-col')}>
            <Switcher selectedTab={selectedTab} agent={agent} />
          </div>
          <div className="agent-details-overlay pb-6">
            <DetailsOverlay agent={agent} />
          </div>
        </div>
      </CenterContent>
    </SelectedTabContext>
  );
}
