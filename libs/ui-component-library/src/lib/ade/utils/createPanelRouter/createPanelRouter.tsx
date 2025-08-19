'use client';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { ZodType } from 'zod';
type PageTitle = string | ((values: ZodType['_output']) => string);

export type GenericPanelRouter<PageKey extends string> = Record<
  PageKey,
  {
    title: PageTitle;
    state: ZodType;
  }
>;

interface RouterContext<PageKeys extends string, PageState extends ZodType> {
  currentPage: PageKeys;
  setCurrentPage: (page: PageKeys, state?: PageState['_output']) => void;
  state: PageState['_output'] | null;
}

interface CreatePageRouterOptions<PageKey extends string> {
  initialPage: PageKey;
}

export function createPageRouter<
  PageKey extends string,
  ThisRouter extends GenericPanelRouter<PageKey>,
>(
  _router: ThisRouter,
  options: CreatePageRouterOptions<
    keyof ThisRouter extends string ? keyof ThisRouter : never
  >,
) {
  type PageKeys = keyof ThisRouter extends string ? keyof ThisRouter : never;

  const RouterContext = createContext<
    RouterContext<PageKeys, ThisRouter[keyof ThisRouter]['state']>
  >({
    currentPage: options.initialPage,
    setCurrentPage: () => {
      throw new Error('setCurrentPage not implemented');
    },
    state: null,
  });

  interface RouterProviderProps {
    rootPageKey: PageKeys;
    pages: Record<PageKeys, React.ReactNode>;
  }

  function RouterProvider(props: RouterProviderProps) {
    const { pages } = props;
    const [currentPage, setCurrentPage] = useState<PageKeys>(
      options.initialPage,
    );
    const [state, setState] = useState<
      ThisRouter[keyof ThisRouter]['state']['_output'] | null
    >(null);

    const handleSetCurrentPage = useCallback(
      (page: PageKeys, state?: ThisRouter[PageKeys]['state']['_output']) => {
        setCurrentPage(page);
        setState(state || null);
      },
      [],
    );

    const contextValue = useMemo(
      () => ({
        currentPage,
        setCurrentPage: handleSetCurrentPage,
        state,
      }),
      [currentPage, handleSetCurrentPage, state],
    );

    const CurrentPageComponent = useMemo(() => {
      return pages[currentPage];
    }, [currentPage, pages]);

    return (
      <RouterContext.Provider value={contextValue}>
        {CurrentPageComponent}
      </RouterContext.Provider>
    );
  }

  return {
    usePanelRouteData: <
      RouterKey extends keyof ThisRouter,
    >(): ThisRouter[RouterKey]['state']['_output'] => {
      return useContext(RouterContext)
        .state as ThisRouter[RouterKey]['state']['_output'];
    },
    usePanelPageContext: <RouterKey extends keyof ThisRouter>(): RouterContext<
      PageKeys,
      ThisRouter[RouterKey]['state']
    > => {
      return useContext(RouterContext) as RouterContext<
        PageKeys,
        ThisRouter[RouterKey]['state']
      >;
    },
    PanelRouter: RouterProvider,
  };
}
