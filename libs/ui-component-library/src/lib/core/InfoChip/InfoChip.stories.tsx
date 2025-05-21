import type { Meta, StoryObj } from '@storybook/react';
import { InfoChip } from './InfoChip';
import { LettaInvaderIcon } from '../../icons';

const meta: Meta<typeof InfoChip> = {
  component: InfoChip,
  title: 'core/InfoChip',
};

export default meta;
type Story = StoryObj<typeof InfoChip>;

export const Primary: Story = {
  args: {
    label: 'Info',
    icon: <LettaInvaderIcon />,
  },
  render: (args) => <InfoChip {...args} />,
};
