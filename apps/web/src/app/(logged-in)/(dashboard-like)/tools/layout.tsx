'use client';
import {
  Button,
  DashboardWithSidebarWrapper,
  HStack,
  PlusIcon,
} from '@letta-cloud/ui-component-library';
import React from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { useToolManagerRouteCopy } from '@letta-cloud/ui-ade-components';
import { CreateToolDialog } from '@letta-cloud/ui-ade-components';
import { ToolsPageLayout } from './_components/ToolsPageLayout/ToolsPageLayout';

interface ToolsLayoutProps {
  children: React.ReactNode;
}

export default function ToolsLayout(props: ToolsLayoutProps) {
  const t = useTranslations('tools/layout');
  const { children } = props;

  const copy = useToolManagerRouteCopy();


  return (
    <DashboardWithSidebarWrapper
      baseUrl="/tools"
      returnOverride="/"
      returnText={t('nav.return')}
      navigationItems={[
        {
          title: t('nav.allTools'),
          items: [
            {
              id: 'home',
              icon: copy.customTools.icon,
              label: copy.customTools.title as string,
              href: `/tools/custom`,
            },
            {
              id: 'multiAgentTools',
              icon: copy.multiAgentTools.icon,
              label: copy.multiAgentTools.title as string,
              href: `/tools/multi-agent`,
            },
            {
              id: 'utilityTools',
              icon: copy.utilityTools.icon,
              label: copy.utilityTools.title as string,
              href: `/tools/utility`,
            },
            {
              id: 'baseTools',
              icon: copy.lettaTools.icon,
              label: copy.lettaTools.title as string,
              href: `/tools/base`,
            },
            {
              override: (
                <HStack>
                  <CreateToolDialog
                    trigger={
                      <Button
                        size="xsmall"
                        data-testid="start-create-tool"
                        preIcon={<PlusIcon />}
                        label={t('createTool')}
                        color="secondary"
                        bold
                      />
                    }
                  />
                </HStack>
              ),
            },
          ],
        },

        {
          title: t('nav.mcpServers'),
          items: [
            {
              id: 'home',
              icon: copy.mcpServers.icon,
              label: copy.mcpServers.title as string,
              href: `/tools/mcp-servers`,
            },
            {
              override: (
                <HStack>
                  <Button
                    href="/tools/mcp-servers/add"
                    size="xsmall"
                    data-testid="start-create-tool"
                    preIcon={<PlusIcon />}
                    label={t('addMCPServer')}
                    color="secondary"
                    bold
                  />
                </HStack>
              ),
            },
          ],
        },
      ]}
    >
      <ToolsPageLayout>{children}</ToolsPageLayout>
    </DashboardWithSidebarWrapper>
  );
}
