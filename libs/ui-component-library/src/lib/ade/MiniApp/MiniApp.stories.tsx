import type { Meta, StoryObj } from '@storybook/react';
import { MiniApp } from './MiniApp';

const meta: Meta<typeof MiniApp> = {
  component: MiniApp,
  title: 'core/MiniApp',
};

export default meta;
type Story = StoryObj<typeof MiniApp>;

export const Primary: Story = {};
