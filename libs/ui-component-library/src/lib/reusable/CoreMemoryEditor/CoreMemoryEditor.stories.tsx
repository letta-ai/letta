import type { Meta, StoryObj } from '@storybook/react';
import { CoreMemoryEditor } from './CoreMemoryEditor';
import { VStack } from '../../framing/VStack/VStack';

const meta: Meta<typeof CoreMemoryEditor> = {
  component: CoreMemoryEditor,
  title: 'reusable/CoreMemoryEditor',
};

export default meta;
type Story = StoryObj<typeof CoreMemoryEditor>;

export const Primary: Story = {
  args: {
    memoryBlock: {
      name: 'persona',
      limit: 10,
      value: 'dsafijoas',
      description:
        'This is a descriptionThis is a descriptionThis is a descriptionThis is a descriptionThis is a descriptionThis is a descriptionThis is a descriptionThis is a descriptionThis is a description',
      read_only: false,
    },
    onSave: () => {
      return;
    },
    sharedAgents: [
      {
        id: '1',
        name: 'Agent 1',
      },
      {
        id: '2',
        name: 'Agent 2',
      },
    ],
  },
  render: (args) => (
    <VStack paddingX="small" className="max-w-[350px]" color="background-grey">
      <CoreMemoryEditor {...args} />
    </VStack>
  ),
};
