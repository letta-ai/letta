import { useQueryClient } from '@tanstack/react-query';

export function useResetAllLettaAgentsQueryKeys() {
  const queryClient = useQueryClient();

  function resetAllLettaAgentsQueryKeys() {
    /* Resets all query keys that have to do with "Service", as that is the common query key name for all letta-agents queries */
    Array.from(queryClient.getQueryCache().getAll().values())
      .filter((query) => query.queryHash.includes('Service'))
      .forEach((query) => {
        void queryClient.resetQueries({
          queryKey: query.queryKey,
        });
      });
  }

  return {
    resetAllLettaAgentsQueryKeys,
  };
}
