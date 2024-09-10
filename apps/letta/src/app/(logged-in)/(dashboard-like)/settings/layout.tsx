import React from 'react';
import { SettingsSidebar } from './_components/SettingsSidebar/SettingsSidebar';
import { HStack } from '@letta-web/component-library';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

function SettingsLayout(props: SettingsLayoutProps) {
  const { children } = props;

  return (
    <HStack gap="large" fullWidth collapseHeight>
      <SettingsSidebar />
      {children}
    </HStack>
  );
}

export default SettingsLayout;
