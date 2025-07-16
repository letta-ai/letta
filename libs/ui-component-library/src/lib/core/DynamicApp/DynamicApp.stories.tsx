import type { Meta, StoryObj } from '@storybook/react';
import { DynamicApp } from './DynamicApp';
import { HStack } from '../../framing/HStack/HStack';

const meta: Meta<typeof DynamicApp> = {
  component: DynamicApp,
  title: 'core/DynamicApp',
};

export default meta;
type Story = StoryObj<typeof DynamicApp>;

export const Primary: Story = {
  render: () => {
    return (
      <HStack>
        <DynamicApp
          windowConfiguration={{
            defaultHeight: 600,
            defaultWidth: 800,
            minHeight: 400,
            minWidth: 600,
          }}
          defaultView="windowed"
          name="Example App"
          trigger={<button>first</button>}
        >
          Zadu
        </DynamicApp>
        <DynamicApp
          defaultView="windowed"
          windowConfiguration={{
            defaultHeight: 600,
            defaultWidth: 800,
            minHeight: 400,
            minWidth: 600,
          }}
          name="Example App 2"
          trigger={<button>second</button>}
        >
          Zadu
        </DynamicApp>
      </HStack>
    );
  },
};
