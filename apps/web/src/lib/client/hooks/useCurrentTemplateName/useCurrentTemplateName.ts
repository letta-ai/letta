'use client'
import { useParams } from 'next/navigation';

export function useCurrentTemplateName() {
  const { templateName } = useParams<{
    templateName: string;
  }>();

  return templateName || '';
}
