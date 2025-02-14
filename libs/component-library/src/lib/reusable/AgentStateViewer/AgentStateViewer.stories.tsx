import type { Meta, StoryObj } from '@storybook/react';
import { AgentStateViewer } from './AgentStateViewer';

const meta: Meta<typeof AgentStateViewer> = {
  component: AgentStateViewer,
  title: 'reusable/AgentStateViewer',
};

export default meta;
type Story = StoryObj<typeof AgentStateViewer>;

export const Primary: Story = {
  args: {
    baseState: {
      tool_exec_environment_variables: [
        {
          key: 'key',
          value: 'value',
        },
      ],
      toolIds: ['1'],
      sourceIds: ['1'],
      llmConfig: {
        model: 'model',
        model_endpoint_type: 'openai',
        model_endpoint: 'model_endpoint',
        model_wrapper: 'model_wrapper',
        context_window: 1,
      },
      embedding_config: {
        embedding_model: 'model',
        embedding_endpoint_type: 'openai',
        embedding_dim: 123,
      },
      memoryBlocks: [
        {
          value:
            'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua',
          label: 'label',
          limit: 5000,
        },
      ],
      promptTemplate: 'promptTemplate',
      system: 'system you',
    },
    comparedState: {
      tool_exec_environment_variables: [
        {
          key: 'key',
          value: 'vaue',
        },
        {
          key: 'key2',
          value: 'value',
        },
      ],
      toolIds: ['1', '2'],
      sourceIds: ['2'],
      llmConfig: {
        model: 'model',
        model_endpoint_type: 'openai',
        model_endpoint: 'model_endpoint',
        model_wrapper: 'model_wrapper',
        context_window: 424,
      },
      embedding_config: {
        embedding_model: 'model',
        embedding_endpoint_type: 'anthropic',
        embedding_dim: 123,
      },
      memoryBlocks: [
        {
          value:
            'lorem ipsum dolor tempor incididunt ut labore et dolore magna aliqua',
          label: 'label',
          limit: 1,
        },
        {
          value:
            'lorem ipsum dolor tempor incididunt ut labore et dolore magna aliqua',
          label: 'du',
          limit: 1,
        },
      ],
      promptTemplate: 'promptTemplate',
      system: 'hello there how are you',
    },
    tools: {
      '1': {
        id: '1',
        name: 'My tool',
        description: "this tool is the best tool you'll ever see",
      },
      '2': {
        id: '2',
        name: 'Old tool',
        description:
          "this tool is the worst tool you'll ever see dolor tempor incididunt ut labore et dolore magna aliquadolor tempor incididunt ut labore et dolore magna aliquadolor tempor incididuntincididunt ut labore et dolore magna aliquadolor tempor incididuntincididunt ut labore et dolore magna aliquadolor tempor incididunt ut labore et dolore magna aliqua",
      },
    },
    sources: {
      '1': {
        id: '1',
        embedding_config: {
          embedding_model: 'model',
          embedding_endpoint_type: 'openai',
          embedding_dim: 123,
        },
        name: 'name',
      },
      '2': {
        id: '2',
        embedding_config: {
          embedding_model: 'model',
          embedding_endpoint_type: 'anthropic',
          embedding_dim: 123,
        },
        name: 'Old name',
      },
    },
  },
};
