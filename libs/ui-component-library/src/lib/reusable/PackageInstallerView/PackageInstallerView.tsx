'use client';
import * as React from 'react';
import { useMemo, useState } from 'react';
import { VStack } from '../../framing/VStack/VStack';
import { TabGroup } from '../../core/TabGroup/TabGroup';
import { HStack } from '../../framing/HStack/HStack';
import { Typography } from '../../core/Typography/Typography';
import { CopyButton } from '../CopyButton/CopyButton';

interface PackageInstallerType {
  name: string;
  installFormatter: (packageNames: string[]) => string;
}

export const NODEJS_INSTALLERS = ['npm', 'yarn', 'pnpm'] as InstallerType[];

function useInstallerTypes() {
  return useMemo(() => {
    return [
      {
        name: 'npm',
        installFormatter: (packageNames: string[]) =>
          `npm install -s ${packageNames.join(' ')}`,
      },
      {
        name: 'yarn',
        installFormatter: (packageNames: string[]) =>
          `yarn add ${packageNames.join(' ')}`,
      },
      {
        name: 'pnpm',
        installFormatter: (packageNames: string[]) =>
          `pnpm add ${packageNames.join(' ')}`,
      },
      {
        name: 'uv',
        installFormatter: (packageNames: string[]) =>
          `uv add ${packageNames.join(' ')}`,
      },
      {
        name: 'pip',
        installFormatter: (packageNames: string[]) =>
          `pip install ${packageNames.join(' ')}`,
      },
      {
        name: 'uv',
        installFormatter: (packageNames: string[]) =>
          `uv add ${packageNames.join(' ')}`,
      },
    ] satisfies PackageInstallerType[];
  }, []);
}

type InstallerType = ReturnType<typeof useInstallerTypes>[number]['name'];

interface PackageInstallerViewProps {
  packageNames: string[];
  installers: InstallerType[];
}

export function PackageInstallerView(props: PackageInstallerViewProps) {
  const { packageNames, installers } = props;

  const installerTypes = useInstallerTypes();

  const [selectedInstallerName, setSelectedInstallerName] = useState(
    installerTypes[0].name,
  );

  const selectedInstaller = useMemo(() => {
    return installerTypes.find(
      (installer) => installer.name === selectedInstallerName,
    );
  }, [selectedInstallerName, installerTypes]);

  const installText = useMemo(() => {
    return selectedInstaller?.installFormatter(packageNames) || '';
  }, [selectedInstaller, packageNames]);

  const tabs = useMemo(() => {
    return installerTypes
      .map((installer) => ({
        label: installer.name,
        value: installer.name,
      }))
      .filter((tab) => installers.includes(tab.value));
  }, [installerTypes, installers]);

  return (
    <VStack gap="small" fullWidth>
      <TabGroup
        variant="chips"
        size="xxsmall"
        items={tabs}
        value={selectedInstallerName}
        onValueChange={setSelectedInstallerName}
      />
      <HStack
        padding="xsmall"
        align="center"
        fullWidth
        border
        color="background-grey"
      >
        <Typography fullWidth variant="body3" overflow="ellipsis" font="mono">
          {installText}
        </Typography>
        <CopyButton size="small" textToCopy={installText} />
      </HStack>
    </VStack>
  );
}
