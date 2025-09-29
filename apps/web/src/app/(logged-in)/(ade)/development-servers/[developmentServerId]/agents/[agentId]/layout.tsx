'use client'

import { useDocumentTitle } from "@mantine/hooks"
import { useCurrentAgent } from '$web/client/hooks/useCurrentAgent/useCurrentAgent';
interface AgentLayoutProps {
  children: React.ReactNode
}

export default function AgentLayout(props: AgentLayoutProps) {
  const { children } = props

  const { name }  = useCurrentAgent();


  useDocumentTitle(name ? `${name} | Letta` : 'Letta')

  return children;
}
