'use client'

import { useDocumentTitle } from "@mantine/hooks"
import { useParams } from 'next/navigation';

interface TemplateLayoutProps {
  children: React.ReactNode
}

export default function TemplateLayout(props: TemplateLayoutProps) {
  const { children } = props

  const { templateName } = useParams<{
    templateName: string;
  }>();

  useDocumentTitle(`${templateName} | Letta`)

  return children;
}
