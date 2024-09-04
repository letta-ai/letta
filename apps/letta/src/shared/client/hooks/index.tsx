import { useQueryClient } from '@tanstack/react-query';

export function useCurrentUser() {
  return useQueryClient;
}
