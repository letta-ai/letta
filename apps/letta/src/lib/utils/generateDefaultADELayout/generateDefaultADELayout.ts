import type { AdePreferencesData } from '$letta/web-api/ade-preferences/adePreferencesContracts';
//
// interface GenerateDefaultPreferencesOptions {
//   firstTime?: boolean;
// }

export function generateDefaultADELayout(): AdePreferencesData {
  // options: GenerateDefaultPreferencesOptions = {}
  // const { firstTime } = options;
  return {
    displayConfig: [
      {
        size: 30,
        positions: [
          {
            size: 50,
            positions: [
              {
                id: 'agent-settings',
                isActive: true,
                templateId: 'agent-settings',
                data: undefined,
              },
              {
                id: 'advanced-settings',
                isActive: false,
                templateId: 'advanced-settings',
                data: undefined,
              },
            ],
          },
          {
            size: 50,
            positions: [
              {
                id: 'tools-panel',
                isActive: true,
                templateId: 'tools-panel',
                data: undefined,
              },
              {
                id: 'edit-data-sources',
                isActive: false,
                templateId: 'edit-data-sources',
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
              // {
              //   id: 'welcome-panel',
              //   isActive: true,
              //   templateId: 'welcome-panel',
              //   data: {
              //     firstTime,
              //   },
              // },
              {
                id: 'agent-simulator',
                isActive: false,
                templateId: 'agent-simulator',
                data: undefined,
              },
            ],
          },
        ],
      },
      {
        size: 30,
        positions: [
          {
            size: 10,
            overridesizeInPx: 85,
            positions: [
              {
                id: 'context-window',
                isActive: true,
                templateId: 'context-window',
                data: undefined,
              },
            ],
          },
          {
            size: 50,
            positions: [
              {
                id: 'edit-core-memories',
                templateId: 'edit-core-memories',
                isActive: true,
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
