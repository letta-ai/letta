import React, { createContext, useMemo } from 'react';
import { useCurrentAgent } from '../../../../../hooks';

interface DataSourceProviderContext {
  selectedDatasourceId: string | null;
  setSelectedDatasource: (id: string | null) => void;
}

const DataSourceContext = createContext<DataSourceProviderContext>({
  selectedDatasourceId: null,
  setSelectedDatasource: () => {
    return;
  },
});

interface DataSourceProviderProps {
  children: React.ReactNode;
}

export function DataSourceProvider(props: DataSourceProviderProps) {
  const { sources } = useCurrentAgent();

  const firstSourceId = useMemo(() => {
    if (!sources || sources.length === 0) {
      return null;
    }
    return sources[0].id || null;
  }, [sources]);

  const [selectedDatasourceId, setSelectedDatasource] = React.useState<
    string | null
  >(firstSourceId);

  return (
    <DataSourceContext.Provider
      value={{
        selectedDatasourceId,
        setSelectedDatasource,
      }}
    >
      {props.children}
    </DataSourceContext.Provider>
  );
}

export function useDataSourceContext() {
  return React.useContext(DataSourceContext);
}
