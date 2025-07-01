import type { Meta, StoryObj } from '@storybook/react';
import { VoteComponent } from './VoteComponent';

const meta: Meta<typeof VoteComponent> = {
  component: VoteComponent,
  title: 'core/VoteComponent',
};

export default meta;
type Story = StoryObj<typeof VoteComponent>;

export const Primary: Story = {
  args: {
    voteCount: 0,
    onVote: (vote) => {
      console.log('Vote:', vote);
    },
    voteType: 'up',
  },
  render: (args) => <VoteComponent {...args} />,
};

export const UpVote: Story = {
  args: {
    voteCount: 1000,
    onVote: (vote) => {
      console.log('Vote:', vote);
    },
    voteType: 'up',
  },
  render: (args) => <VoteComponent {...args} />,
};

export const DownVote: Story = {
  args: {
    voteCount: 5,
    onVote: (vote) => {
      console.log('Vote:', vote);
    },
    voteType: 'down',
  },
  render: (args) => <VoteComponent {...args} />,
};

export const DownVoted: Story = {
  args: {
    voteCount: 6,
    onVote: (vote) => {
      console.log('Vote:', vote);
    },
    isVoted: true,
    voteType: 'down',
  },
  render: (args) => <VoteComponent {...args} />,
};
