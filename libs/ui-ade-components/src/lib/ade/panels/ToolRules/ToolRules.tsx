// import React, { useState, useCallback } from 'react';
import { HStack, VStack } from '@letta-cloud/ui-component-library';
import { useCurrentAgent } from '../../../hooks';
import { ToolRulesList } from './ToolRulesList';
import { ToolRulesVisual } from './ToolRulesVisual';

export function ToolRulesEditor() {
  const agent = useCurrentAgent();
  return (
    <HStack gap={false} fullHeight fullWidth>
      <VStack fullHeight flex>
        <ToolRulesList defaultToolRules={agent?.tool_rules} />
      </VStack>
      <VStack fullHeight flex borderLeft>
        <ToolRulesVisual tools={agent.tools} toolRules={agent.tool_rules} />
      </VStack>
    </HStack>
  );
}
