'use client';
import type { GetAgentFileDetails } from '@letta-cloud/sdk-web';
import {
  BlockViewer,
  TabGroup,
  ToolLanguageIcon,
  Typography,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { CenterContent } from '../../../../../lib/client/components/CenterContent/CenterContent';
import { createContext, useContext, useState } from 'react';

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
          label: t('toolRules'),
          value: 'toolRules',
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
      {description && (
        <Typography variant="large" light>
          {description}
        </Typography>
      )}
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
      <BlockViewer
        title={t('system')}
        maxLines={4}
        elements={[
          {
            value: system,
          },
        ]}
      />
    </>
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
        <BlockViewer
          title="Memory Blocks"
          elements={agent.memory.map((block) => ({
            label: block.label,
            value: block.value,
          }))}
        />
      );
    case 'tools':
      return (
        <BlockViewer
          title="Tools"
          elements={agent.tools.map((tool) => ({
            label: tool.name,
            value: tool.description,
          }))}
        />
      );
    case 'toolRules':
      return <Typography>Tool Rules will be displayed here.</Typography>;
    case 'toolVariables':
      return <Typography>Tool Variables will be displayed here.</Typography>;
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
        <div className="pt-[24px]">
          <Tabber
            value={selectedTab}
            onChange={(value) => {
              setSelectedTab(value);
            }}
          />
        </div>
        <div className="gap-[32px] max-w-[560px] py-[32px] flex flex-col">
          <Switcher selectedTab={selectedTab} agent={agent} />
        </div>
      </CenterContent>
    </SelectedTabContext>
  );
}
