import type { Meta, StoryObj } from '@storybook/react';
import { FileTree } from './FileTree';

const meta: Meta<typeof FileTree> = {
  component: FileTree,
  title: 'core/FileTree',
};

export default meta;
type Story = StoryObj<typeof FileTree>;

export const Primary: Story = {
  argTypes: {
    root: {},
  },
  args: {
    root: [
      {
        name: 'Folder 1',
        contents: [
          {
            name: 'Subfolder 1',
            contents: [
              {
                name: 'File 1',
                wrapper: ({ children }) => <div>{children}</div>,
              },
            ],
          },
        ],
      },
      {
        name: 'Folder 2',
        contents: [
          {
            name: 'File 2',
            wrapper: ({ children }) => <div>{children}</div>,
          },
        ],
      },
      {
        name: 'Folder 3',
        useContents: () => ({
          data: [
            {
              name: 'File 3',
              wrapper: ({ children }) => <div>{children}</div>,
            },
          ],
          isLoading: true,
        }),
      },
    ],
  },
};
