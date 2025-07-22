import type { Meta, StoryObj } from '@storybook/react';
import { PageSelector } from './PageSelector';

const meta: Meta<typeof PageSelector> = {
  component: PageSelector,
  title: 'core/PageSelector',
};

export default meta;
type Story = StoryObj<typeof PageSelector>;

export const Primary: Story = {
  args: {
    visiblePageCount: 5,
    totalPages: 100,
    currentPage: 1,
    onPageChange: (page: number) => {
      console.log(`Page changed to: ${page}`);
    },
  },
};
