import * as React from 'react';
import { act, useEffect } from 'react';
import { render, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import type {
  GenericPanelTemplateId,
  PanelItemPositionsMatrix,
} from './createPanelManager';
import { createPanelManager } from './createPanelManager';
import { z } from 'zod';
import { screen } from '@testing-library/react';

function Component({ test }: { test: string }) {
  return <div>{test}</div>;
}

const { usePanelManager, PanelRenderer, PanelManagerProvider } =
  createPanelManager({
    'test-panel': {
      templateId: 'test-panel',
      useGetTitle: () => 'Test Panel',
      data: z.object({
        test: z.string(),
      }),
      content: Component,
    },
  });

function generateWrapper({
  initialPositions,
}: {
  initialPositions: PanelItemPositionsMatrix<GenericPanelTemplateId>;
}) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <PanelManagerProvider
        fallbackPositions={initialPositions}
        onPositionError={(e) => {
          console.log(e);
        }}
        initialPositions={initialPositions}
      >
        {children}
      </PanelManagerProvider>
    );
  };
}

const activePanelPosition = {
  isActive: true,
  data: { test: 'test' },
  templateId: 'test-panel',
};

const inactivePanelPosition = {
  templateId: 'test-panel',
  isActive: false,
  data: { test: 'test' },
};

describe('usePanelManager', () => {
  describe('openPanel', () => {
    it('should open a panel when there are no panel positions', () => {
      const { result } = renderHook(
        () => {
          return usePanelManager();
        },
        {
          wrapper: generateWrapper({
            initialPositions: [],
          }),
        }
      );

      act(() => {
        result.current.openPanel({
          templateId: 'test-panel',
          id: 'test-panel',
          data: { test: 'test' },
        });
      });

      expect(result.current.positions).toEqual([
        {
          size: 100,
          positions: [
            {
              positions: [{ ...activePanelPosition, id: 'test-panel' }],
              size: 100,
            },
          ],
        },
      ]);
    });

    it('should open a panel when other panel positions exist', () => {
      const { result } = renderHook(
        () => {
          return usePanelManager();
        },
        {
          wrapper: generateWrapper({
            initialPositions: [
              {
                size: 1,
                positions: [
                  {
                    size: 1,
                    positions: [],
                  },
                  {
                    size: 2,
                    positions: [],
                  },
                  {
                    size: 1,
                    positions: [
                      { ...activePanelPosition, id: '1' },
                      { ...inactivePanelPosition, id: '2' },
                    ],
                  },
                ],
              },
            ],
          }),
        }
      );

      act(() => {
        result.current.openPanel({
          templateId: 'test-panel',
          id: 'test-panel',
          data: { test: 'test' },
        });
      });

      expect(result.current.positions).toEqual([
        {
          positions: [
            {
              positions: [
                {
                  data: { test: 'test' },
                  id: '1',
                  isActive: false,
                  templateId: 'test-panel',
                },
                {
                  data: { test: 'test' },
                  id: 'test-panel',
                  isActive: true,
                  templateId: 'test-panel',
                },
                {
                  data: { test: 'test' },
                  id: '2',
                  isActive: false,
                  templateId: 'test-panel',
                },
              ],
              size: 100,
            },
          ],
          size: 100,
        },
      ]);
    });

    it.skip('should open a new active panel right after the existing active panel', () => {
      const { result } = renderHook(
        () => {
          return usePanelManager();
        },
        {
          wrapper: generateWrapper({
            initialPositions: [
              [
                [
                  { ...inactivePanelPosition, id: '1' },
                  { ...activePanelPosition, id: '2' },
                  { ...inactivePanelPosition, id: '3' },
                ],
              ],
            ],
          }),
        }
      );

      act(() => {
        result.current.openPanel({
          templateId: 'test-panel',
          id: 'test-panel',
          data: { test: 'test' },
        });
      });

      expect(result.current.positions).toEqual([
        [
          [
            { ...inactivePanelPosition, id: '1' },
            { ...inactivePanelPosition, id: '2' },
            { ...activePanelPosition, id: 'test-panel' },
            { ...inactivePanelPosition, id: '3' },
          ],
        ],
      ]);
    });

    it.skip('should not open a panel if the panel is already open', () => {
      const { result } = renderHook(
        () => {
          return usePanelManager();
        },
        {
          wrapper: generateWrapper({
            initialPositions: [
              [
                [
                  { ...inactivePanelPosition, id: '1' },
                  { ...activePanelPosition, id: '2' },
                  { ...inactivePanelPosition, id: '3' },
                ],
              ],
            ],
          }),
        }
      );

      act(() => {
        result.current.openPanel({
          templateId: 'test-panel',
          id: '2',
          data: { test: 'test' },
        });
      });

      expect(result.current.positions).toEqual([
        [
          [
            { ...inactivePanelPosition, id: '1' },
            { ...activePanelPosition, id: '2' },
            { ...inactivePanelPosition, id: '3' },
          ],
        ],
      ]);
    });
  });

  describe('movePanelToPosition', () => {
    it.skip('should move a panel to a new position', () => {
      const { result } = renderHook(
        () => {
          return usePanelManager();
        },
        {
          wrapper: generateWrapper({
            initialPositions: [
              [
                [
                  { ...inactivePanelPosition, id: '1' },
                  { ...activePanelPosition, id: '2' },
                  { ...inactivePanelPosition, id: '3' },
                ],
              ],
            ],
          }),
        }
      );

      act(() => {
        result.current.movePanelToPosition('1', [0, 0, 4]);
      });

      expect(result.current.positions).toEqual([
        [
          [
            { ...inactivePanelPosition, id: '2' },
            { ...inactivePanelPosition, id: '3' },
            { ...activePanelPosition, id: '1' },
          ],
        ],
      ]);
    });

    it.skip('should move panel to a new x position', () => {
      const { result } = renderHook(
        () => {
          return usePanelManager();
        },
        {
          wrapper: generateWrapper({
            initialPositions: [
              [
                [
                  { ...inactivePanelPosition, id: '1' },
                  { ...activePanelPosition, id: '2' },
                  { ...inactivePanelPosition, id: '3' },
                ],
              ],
            ],
          }),
        }
      );

      act(() => {
        result.current.movePanelToPosition('1', [1, 1, 0]);
      });

      expect(result.current.positions).toEqual([
        [
          [
            { ...activePanelPosition, id: '2' },
            { ...inactivePanelPosition, id: '3' },
          ],
        ],
        [[{ ...activePanelPosition, id: '1' }]],
      ]);
    });

    it.skip('should move panel to a new y position', () => {
      const { result } = renderHook(
        () => {
          return usePanelManager();
        },
        {
          wrapper: generateWrapper({
            initialPositions: [
              [
                [
                  { ...inactivePanelPosition, id: '1' },
                  { ...activePanelPosition, id: '2' },
                  { ...inactivePanelPosition, id: '3' },
                ],
              ],
            ],
          }),
        }
      );

      act(() => {
        result.current.movePanelToPosition('1', [0, 2, 0]);
      });

      expect(result.current.positions).toEqual([
        [
          [
            { ...activePanelPosition, id: '2' },
            { ...inactivePanelPosition, id: '3' },
          ],
          [{ ...activePanelPosition, id: '1' }],
        ],
      ]);
    });

    it.skip('should move panel to a new x position when theres already another element there', () => {
      const { result } = renderHook(
        () => {
          return usePanelManager();
        },
        {
          wrapper: generateWrapper({
            initialPositions: [
              [
                [
                  { ...inactivePanelPosition, id: '1' },
                  { ...activePanelPosition, id: '2' },
                  { ...inactivePanelPosition, id: '3' },
                ],
              ],
              [[{ ...activePanelPosition, id: '4' }]],
            ],
          }),
        }
      );

      act(() => {
        result.current.movePanelToPosition('1', [1, 0, 0]);
      });

      expect(result.current.positions).toEqual([
        [
          [
            { ...activePanelPosition, id: '2' },
            { ...inactivePanelPosition, id: '3' },
          ],
        ],
        [
          [
            { ...activePanelPosition, id: '1' },
            { ...inactivePanelPosition, id: '4' },
          ],
        ],
      ]);
    });
  });

  describe('PanelRenderer', () => {
    it('should render a panel', async () => {
      const Wrapper = generateWrapper({
        initialPositions: [
          {
            size: 1,
            positions: [
              {
                size: 1,
                positions: [{ ...activePanelPosition, id: '1' }],
              },
            ],
          },
        ],
      });

      function InnerComponent() {
        const { openPanel } = usePanelManager();

        useEffect(() => {
          openPanel({
            templateId: 'test-panel',
            id: 'test-panel',
            data: { test: 'hello my cheese' },
          });
        }, [openPanel]);

        return <PanelRenderer />;
      }

      render(<InnerComponent />, { wrapper: Wrapper });

      expect(await screen.findByText('hello my cheese')).toBeTruthy();
    });
  });
});
