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
            size: 30,
            positions: [
              {
                id: 'model-details',
                isActive: true,
                templateId: 'model-details',
                data: undefined,
              },
              // {
              //   id: 'agent-config',
              //   isActive: false,
              //   templateId: 'agent-config',
              //   data: undefined,
              // },
            ],
          },
          {
            size: 70,
            positions: [
              {
                id: 'edit-core-memories',
                templateId: 'edit-core-memories',
                isActive: true,
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
          {
            size: 50,
            positions: [
              {
                id: 'edit-data-sources',
                isActive: true,
                templateId: 'edit-data-sources',
                data: undefined,
              },
            ],
          },
        ],
      },
    ],
  };
}
