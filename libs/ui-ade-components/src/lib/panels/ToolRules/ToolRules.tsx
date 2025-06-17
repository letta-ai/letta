import { HStack, VStack } from '@letta-cloud/ui-component-library';
import { useCurrentAgent } from '../../hooks';
import { ToolRulesList } from './ToolRulesList';
import { ToolRulesVisual } from './ToolRulesVisual';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

export function ToolRulesEditor() {
  const agent = useCurrentAgent();
  const { data: splitEnabled } = useFeatureFlag('TOOL_RULE_VIEWER');

  if (splitEnabled) {
    return (
      <HStack gap={false} fullHeight fullWidth>
        <VStack fullHeight flex>
          <ToolRulesList defaultToolRules={agent?.tool_rules} />
        </VStack>
        <VStack fullHeight flex borderLeft>
          <ToolRulesVisual />
        </VStack>
      </HStack>
    );
  }

  return <ToolRulesList defaultToolRules={agent?.tool_rules} />;
}
