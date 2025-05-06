'use client';
import { useQuery } from '@tanstack/react-query';
import { Tiktoken } from 'js-tiktoken/lite';

export function useTikTokenEncoder() {
  return useQuery({
    queryKey: ['tikTokenEncoder'],
    queryFn: async () => {
      const res = await fetch(`https://tiktoken.pages.dev/js/o200k_base.json`);
      const o200kBase = await res.json();
      return new Tiktoken(o200kBase);
    },
  });
}
