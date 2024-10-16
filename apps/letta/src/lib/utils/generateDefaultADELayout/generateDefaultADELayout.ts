import type { AdePreferencesData } from '$letta/web-api/ade-preferences/adePreferencesContracts';

interface GenerateDefaultPreferencesOptions {
  firstTime?: boolean;
}

export function generateDefaultADELayout(
  options: GenerateDefaultPreferencesOptions = {}
): AdePreferencesData {
  const { firstTime } = options;
  return {
    displayConfig: [
      {
        size: 35,
        positions: [
          {
            size: 20,
            positions: [
              {
                id: 'model-details',
                isActive: true,
                templateId: 'model-details',
                data: undefined,
              },
              {
                id: 'agent-config',
                isActive: false,
                templateId: 'agent-config',
                data: undefined,
              },
            ],
          },
          {
            size: 60,
            positions: [
              {
                id: 'edit-core-memories',
                templateId: 'edit-core-memories',
                isActive: true,
                data: undefined,
              },
              {
                id: 'edit-data-sources',
                isActive: false,
                templateId: 'edit-data-sources',
                data: undefined,
              },
              {
                id: 'tools-panel',
                isActive: false,
                templateId: 'tools-panel',
                data: undefined,
              },
            ],
          },
        ],
      },
      {
        size: 40,
        positions: [
          {
            size: 100,
            positions: [
              {
                id: 'agent-simulator',
                isActive: true,
                templateId: 'agent-simulator',
                data: undefined,
              },
            ],
          },
        ],
      },
      {
        size: 35,
        positions: [
          {
            size: 50,
            positions: [
              {
                id: 'welcome-panel',
                isActive: true,
                templateId: 'welcome-panel',
                data: {
                  firstTime,
                },
              },
              {
                id: 'deployment',
                isActive: false,
                templateId: 'deployment',
                data: undefined,
              },
              {
                id: 'deployed-agents',
                isActive: false,
                templateId: 'deployed-agents',
                data: undefined,
              },
            ],
          },
          {
            size: 50,
            positions: [
              {
                id: 'archival-memories',
                isActive: true,
                templateId: 'archival-memories',
                data: undefined,
              },
            ],
          },
        ],
      },
    ],
  };
}
