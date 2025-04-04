import type { AgentState } from '@letta-cloud/sdk-core';
import {
  LettaInvaderIcon,
  LettaInvaderOutlineIcon,
  LettaInvaderSleeptimeIcon,
} from '../../icons';
import { Tooltip } from '../Tooltip/Tooltip';

interface LettaAgentTypeIconProps {
  type: AgentState['agent_type'];
}

function LettaAgentTypeIconInner(props: LettaAgentTypeIconProps) {
  const { type } = props;
  switch (type) {
    case 'memgpt_agent':
      return <LettaInvaderIcon />;
    case 'sleeptime_agent':
      return <LettaInvaderSleeptimeIcon />;
    default:
      return <LettaInvaderOutlineIcon />;
  }
}

export function LettaAgentTypeIcon(props: LettaAgentTypeIconProps) {
  return (
    <Tooltip asChild content={props.type}>
      <div>
        <LettaAgentTypeIconInner {...props} />
      </div>
    </Tooltip>
  );
}
