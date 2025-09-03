import { ActionCard, VStack } from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';
import { CoreMemoryBlock } from '../types';

export interface ExampleBlockPayload {
  label: string;
  description: string;
  value: string;
}

interface ExampleBlocksProps {
  onSelect: (block: ExampleBlockPayload) => void;
  setBlockType: (value: string) => void;
}

export function ExampleBlocks(props: ExampleBlocksProps) {
  const { onSelect, setBlockType } = props;
  const t = useTranslations('CreateNewMemoryBlockDialog/ExampleBlocks');

  return (
    <VStack>
      <ActionCard
        onClick={() => {
          setBlockType(CoreMemoryBlock.EXAMPLE);
          onSelect({
            label: 'human',
            description: t('human.description'),
            value: `This is my section of core memory devoted to information about the human.
I don't yet know anything about them.
What's their name? Where are they from? What do they do? Who are they?
I should update this memory over time as I interact with the human and learn more about them.
`,
          });
        }}
        title={t('human.title')}
        description={t('human.description')}
      ></ActionCard>
      <ActionCard
        onClick={() => {
          setBlockType(CoreMemoryBlock.EXAMPLE);
          onSelect({
            label: 'persona',
            description: t('persona.description'),
            value: `This is my section of core memory devoted to information myself.
There's nothing here yet.
I should update this memory over time as I develop my personality.
`,
          });
        }}
        title={t('persona.title')}
        description={t('persona.description')}
      ></ActionCard>
      <ActionCard
        onClick={() => {
          setBlockType(CoreMemoryBlock.EXAMPLE);
          onSelect({
            label: 'organization',
            description: t('organization.description'),
            value:
              'Nothing here yet.\n' + '\n' + '\n' + '\n' + '\n' + '\n' + '\n',
          });
        }}
        title={t('organization.title')}
        description={t('organization.description')}
      ></ActionCard>
    </VStack>
  );
}
