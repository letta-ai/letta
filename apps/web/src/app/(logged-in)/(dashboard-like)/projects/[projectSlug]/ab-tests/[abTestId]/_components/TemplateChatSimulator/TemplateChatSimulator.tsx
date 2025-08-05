import type { AbTestTemplatesSchemaType } from '@letta-cloud/sdk-web';
import {
  HStack,
  TemplateIcon,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import { FlushSimulationSessionDialog } from '@letta-cloud/ui-ade-components';
import { Messages } from '@letta-cloud/ui-ade-components';
import { SimulatorTemplateActions } from '../SimulatorTemplateActions/SimulatorTemplateActions';

interface TemplateChatSimulatorProps {
  template: AbTestTemplatesSchemaType;
}

export function TemplateChatSimulator(props: TemplateChatSimulatorProps) {
  const { template } = props;

  return (
    <VStack fullHeight fullWidth gap={false}>
      <HStack
        color="background"
        align="center"
        paddingX="medium"
        padding="small"
        fullWidth
        justify="spaceBetween"
        borderBottom
      >
        <HStack align="center">
          <TemplateIcon />
          <Typography bold variant="body2">
            {template.templateName}
          </Typography>
        </HStack>
        <HStack gap={false}>
          <FlushSimulationSessionDialog
            templateId={template.id}
            simulatedAgentId={template.simulatedAgentId}
          />
          <SimulatorTemplateActions template={template} />
        </HStack>
      </HStack>
      <VStack collapseHeight overflowY="auto">
        <Messages
          isSendingMessage={false}
          agentId={template.coreAgentId}
          mode="interactive"
        />
      </VStack>
    </VStack>
  );
}
