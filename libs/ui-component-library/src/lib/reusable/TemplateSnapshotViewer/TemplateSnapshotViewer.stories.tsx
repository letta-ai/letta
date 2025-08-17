import type { Meta, StoryObj } from '@storybook/react';
import { TemplateSnapshotViewer } from './TemplateSnapshotViewer';

const meta: Meta<typeof TemplateSnapshotViewer> = {
  component: TemplateSnapshotViewer,
  title: 'reusable/AgentStateViewer',
};

export default meta;
type Story = StoryObj<typeof TemplateSnapshotViewer>;

export const Primary: Story = {
  args: {
    baseName: 'hello',
    comparedName: 'world',
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
      memory: {
        blocks: [
          {
            value:
              'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua',
            label: 'label',
            limit: 5000,
          },
        ],
      },
      promptTemplate: 'promptTemplate',
      system: 'system you',
    },
    comparedState: {
      tool_exec_environment_variables: [
        {
          agent_id: '12',
          key: 'key',
          value: 'vaue',
        },
        {
          agent_id: '123',
          key: 'key2',
          value: 'value',
        },
      ],
      tool_ids: ['1', '2'],
      sourceIds: ['2'],
      llm_config: {
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
      memory: {
        blocks: [
          {
            value:
              'lorem ipsum dolor sit amet consectetur hello adipiscing elit sed do eiusmod tempor incididunt ut labore',
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
      },
      promptTemplate: 'promptTemplate',
      system: 'hello there how are you',
    },
    tools: [
      {
        id: '1',
        name: 'My tool',
        description: "this tool is the best tool you'll ever see",
      },
      {
        id: '2',
        name: 'Old tool',
        description:
          "this tool is the worst tool you'll ever see dolor tempor incididunt ut labore et dolore magna aliquadolor tempor incididunt ut labore et dolore magna aliquadolor tempor incididuntincididunt ut labore et dolore magna aliquadolor tempor incididuntincididunt ut labore et dolore magna aliquadolor tempor incididunt ut labore et dolore magna aliqua",
      },
    ],
    sources: [
      {
        id: '1',
        embedding_config: {
          embedding_model: 'model',
          embedding_endpoint_type: 'openai',
          embedding_dim: 123,
        },
        name: 'name',
      },
      {
        id: '2',
        embedding_config: {
          embedding_model: 'model',
          embedding_endpoint_type: 'anthropic',
          embedding_dim: 123,
        },
        name: 'Old name',
      },
    ],
  },
};
