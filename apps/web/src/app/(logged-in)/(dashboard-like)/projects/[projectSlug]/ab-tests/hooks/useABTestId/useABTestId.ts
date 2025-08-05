'use client';
import { useParams } from 'next/navigation';

export function useABTestId() {
  const { abTestId } = useParams<{ abTestId: string }>();

  return abTestId;
}
