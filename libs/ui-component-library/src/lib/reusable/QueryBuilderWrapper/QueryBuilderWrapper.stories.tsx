import type { Meta, StoryObj } from '@storybook/react';
import { QueryBuilderWrapper } from './QueryBuilderWrapper';

const meta: Meta<typeof QueryBuilderWrapper> = {
  component: QueryBuilderWrapper,
  title: 'reusable/QueryBuilderWrapper',
};

export default meta;
type Story = StoryObj<typeof QueryBuilderWrapper>;

export const Primary: Story = {};
