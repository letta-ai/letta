import type { Meta, StoryObj } from '@storybook/react';
import { CoreMemoryEditor } from './CoreMemoryEditor';
import { VStack } from '../../framing/VStack/VStack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
    isSaving: false,
    onSave: () => {
      console.log('Save clicked');
    },
    sharedAgents: [
      {
        id: '1',
        name: 'Agent 1',
        agentType: 'memgpt_agent',
        onClick: () => console.log('Clicked Agent 1'),
      },
      {
        id: '2',
        name: 'Agent 2',
        agentType: 'memgpt_agent',
        onClick: () => console.log('Clicked Agent 2'),
      },
    ],
  },
  render: (args) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return (
      <QueryClientProvider client={queryClient}>
        <VStack
          paddingX="small"
          className="max-w-[350px]"
          color="background-grey"
        >
          <CoreMemoryEditor {...args} />
        </VStack>
      </QueryClientProvider>
    );
  },
};
