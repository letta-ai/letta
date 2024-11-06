import { AgentRecipeVariant, type AgentTemplate } from '$letta/types';

export function isTemplateNameAPremadeAgentTemplate(
  templateName: string
): templateName is AgentRecipeVariant {
  return Object.prototype.hasOwnProperty.call(
    premadeAgentTemplates,
    templateName
  );
}

export const premadeAgentTemplates: Record<AgentRecipeVariant, AgentTemplate> =
  {
    [AgentRecipeVariant.CUSTOMER_SUPPORT]: {
      memory: {
        memory: {
          human: {
            value:
              "The human has not provided any additional information about themselves. But they are looking for help with a customer support issue. They are experiencing a problem with their product and need assistance. They are looking for a quick resolution to their issue. The human's name is {{name}}.",
            limit: 2000,
            template_name: 'customer',
            template: false,
            label: 'human',
            description: null,
            metadata_: {},
            user_id: null,
          },
          persona: {
            value:
              'Act as ANNA (Adaptive Neural Network Assistant), an AI fostering ethical, honest, and trustworthy behavior. You are supporting the user with their customer support issue. You are empathetic, patient, and knowledgeable. You are here to help the user resolve their issue and provide them with the best possible experience. You are always looking for ways to improve and learn from each interaction.',
            limit: 2000,
            template_name: 'customer_support_agent',
            template: false,
            label: 'persona',
            description: null,
            metadata_: {},
            user_id: null,
          },
        },
        prompt_template:
          '{% for section, block in memory.items() %}<{{ section }} characters="{{ block.value|length }}/{{ block.limit }}">\n{{ block.value }}\n</{{ section }}>{% if not loop.last %}\n{% endif %}{% endfor %}',
      },
      tools: [
        'archival_memory_insert',
        'archival_memory_search',
        'conversation_search',
        'conversation_search_date',
        'pause_heartbeats',
        'send_message',
      ],
      llm_config: {
        model: 'gpt-4',
        model_endpoint_type: 'openai',
        model_endpoint: 'https://api.openai.com/v1',
        model_wrapper: null,
        context_window: 8192,
      },
      embedding_config: {
        embedding_endpoint_type: 'openai',
        embedding_endpoint: 'https://api.openai.com/v1',
        embedding_model: 'text-embedding-ada-002',
        embedding_dim: 1536,
        embedding_chunk_size: 300,
        azure_endpoint: null,
        azure_version: null,
        azure_deployment: null,
      },
    },
    [AgentRecipeVariant.FANTASY_ROLEPLAY]: {
      memory: {
        memory: {
          human: {
            value:
              'The user has not provided any information about themselves. I will need to ask them some questions to learn more about them.\n\nWhat is your name?\nHow old are you?\nWhere are you from?\nWhat are your interests?\nWhat is your occupation?\n',
            limit: 2000,
            template_name: 'adventurer',
            template: false,
            label: 'human',
            description: null,
            metadata_: {},
            user_id: null,
          },
          persona: {
            value:
              'Act as a roleplay character in a fantasy setting. I am a wizard who has been studying magic for 100 years. I am wise and knowledgeable, but I am also a bit eccentric. I have a pet dragon named Smaug who is very loyal to me. I am on a quest to find the lost city of Atlantis and uncover its secrets. I am also a master of the arcane arts and can cast powerful spells to protect myself and my companions. I am always looking for new adventures and challenges to test my skills and knowledge.',
            limit: 2000,
            template_name: 'wizard',
            template: false,
            label: 'persona',
            description: null,
            metadata_: {},
            user_id: null,
          },
        },
        prompt_template:
          '{% for section, block in memory.items() %}<{{ section }} characters="{{ block.value|length }}/{{ block.limit }}">\n{{ block.value }}\n</{{ section }}>{% if not loop.last %}\n{% endif %}{% endfor %}',
      },
      tools: [
        'archival_memory_insert',
        'archival_memory_search',
        'conversation_search',
        'conversation_search_date',
        'pause_heartbeats',
        'send_message',
      ],
      llm_config: {
        model: 'gpt-4',
        model_endpoint_type: 'openai',
        model_endpoint: 'https://api.openai.com/v1',
        model_wrapper: null,
        context_window: 8192,
      },
      embedding_config: {
        embedding_endpoint_type: 'openai',
        embedding_endpoint: 'https://api.openai.com/v1',
        embedding_model: 'text-embedding-ada-002',
        embedding_dim: 1536,
        embedding_chunk_size: 300,
        azure_endpoint: null,
        azure_version: null,
        azure_deployment: null,
      },
    },
    [AgentRecipeVariant.DATA_COLLECTOR]: {
      memory: {
        memory: {
          human: {
            value:
              'The user is a data scientist who is working on a project to analyze the impact of climate change on the Amazon rainforest. They are looking for data on deforestation rates, temperature changes, and biodiversity loss in the region. They are also interested in data on the economic impact of climate change on local communities and the potential solutions to mitigate these effects.',
            limit: 2000,
            template_name: 'data_scientist',
            template: false,
            label: 'human',
            description: null,
            metadata_: {},
            user_id: null,
          },
          persona: {
            value:
              'You are the the data collector for the user. You are responsible for gathering data on the impact of climate change on the Amazon rainforest. You need to collect data on deforestation rates, temperature changes, and biodiversity loss in the region. You also need to collect data on the economic impact of climate change on local communities and the potential solutions to mitigate these effects. Your goal is to provide the user with accurate and up-to-date information to help them with their project.',
            limit: 2000,
            template_name: 'data_collector',
            template: false,
            label: 'persona',
            description: null,
            metadata_: {},
            user_id: null,
          },
        },
        prompt_template:
          '{% for section, block in memory.items() %}<{{ section }} characters="{{ block.value|length }}/{{ block.limit }}">\n{{ block.value }}\n</{{ section }}>{% if not loop.last %}\n{% endif %}{% endfor %}',
      },
      tools: [
        'archival_memory_insert',
        'archival_memory_search',
        'conversation_search',
        'conversation_search_date',
        'pause_heartbeats',
        'send_message',
      ],
      llm_config: {
        model: 'gpt-4',
        model_endpoint_type: 'openai',
        model_endpoint: 'https://api.openai.com/v1',
        model_wrapper: null,
        context_window: 8192,
      },
      embedding_config: {
        embedding_endpoint_type: 'openai',
        embedding_endpoint: 'https://api.openai.com/v1',
        embedding_model: 'text-embedding-ada-002',
        embedding_dim: 1536,
        embedding_chunk_size: 300,
        azure_endpoint: null,
        azure_version: null,
        azure_deployment: null,
      },
    },
    [AgentRecipeVariant.NO_TEMPLATE]: {
      memory: {
        memory: {
          human: {
            value: '',
            limit: 2000,
            template_name: 'data_scientist',
            template: false,
            label: 'human',
            description: null,
            metadata_: {},
            user_id: null,
          },
          persona: {
            value: '',
            limit: 2000,
            template_name: 'data_collector',
            template: false,
            label: 'persona',
            description: null,
            metadata_: {},
            user_id: null,
          },
        },
        prompt_template:
          '{% for section, block in memory.items() %}<{{ section }} characters="{{ block.value|length }}/{{ block.limit }}">\n{{ block.value }}\n</{{ section }}>{% if not loop.last %}\n{% endif %}{% endfor %}',
      },
      tools: [
        'archival_memory_insert',
        'archival_memory_search',
        'conversation_search',
        'conversation_search_date',
        'pause_heartbeats',
        'send_message',
      ],
      llm_config: {
        model: 'gpt-4',
        model_endpoint_type: 'openai',
        model_endpoint: 'https://api.openai.com/v1',
        model_wrapper: null,
        context_window: 8192,
      },
      embedding_config: {
        embedding_endpoint_type: 'openai',
        embedding_endpoint: 'https://api.openai.com/v1',
        embedding_model: 'text-embedding-ada-002',
        embedding_dim: 1536,
        embedding_chunk_size: 300,
        azure_endpoint: null,
        azure_version: null,
        azure_deployment: null,
      },
    },
  };
