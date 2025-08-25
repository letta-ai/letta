'use client';
import {
  Alert,
  HStack,
  InfoTooltip,
  NiceGridDisplay,
  StarterKitItems,
  TabGroup,
  Typography,
  VStack,
} from '@letta-cloud/ui-component-library';
import type { StarterKitArchitecture } from '@letta-cloud/config-agent-starter-kits';
import {
  STARTER_KITS,
  type StarterKit,
} from '@letta-cloud/config-agent-starter-kits';
import { useMemo, useState } from 'react';
import { useTranslations } from '@letta-cloud/translations';

interface ArchitectureSelectorProps {
  architectures: StarterKitArchitecture[];
  currentArchitecture: StarterKitArchitecture;
  onChange: (architecture: StarterKitArchitecture) => void;
}

function ArchitectureSelector(props: ArchitectureSelectorProps) {
  const { architectures, currentArchitecture, onChange } = props;
  const t = useTranslations('components/StarterKitSelector');

  const translatedArchitecturesMap: Record<StarterKitArchitecture, string> =
    useMemo(
      () => ({
        memgpt: t('memgpt'),
        sleeptime: t('sleepTime'),
        memgpt_v2_agent: t('memgpt'),
      }),
      [t],
    );

  return (
    <HStack
      border
      paddingX="small"
      gap="large"
      paddingY="xxsmall"
      fullWidth
      align="center"
    >
      <HStack>
        <Typography variant="body2" bold noWrap>
          {t('ArchitectureSelector.title')}
        </Typography>
        <InfoTooltip text={t('ArchitectureSelector.description')} />
      </HStack>
      <TabGroup
        color="brand"
        size="small"
        variant="chips"
        value={currentArchitecture}
        items={architectures.map((a) => ({
          label: translatedArchitecturesMap[a],
          value: a,
        }))}
        onValueChange={(value) => {
          onChange(value as StarterKitArchitecture);
        }}
      />
    </HStack>
  );
}

interface StarterKitSelectorProps {
  onSelectStarterKit: (title: string, starterKit: StarterKit) => void;
  architectures: StarterKitArchitecture[];
}

export function StarterKitSelector(props: StarterKitSelectorProps) {
  const { onSelectStarterKit, architectures } = props;

  const [currentArchitecture, setCurrentArchitecture] =
    useState<StarterKitArchitecture>(architectures[0] || 'memgpt');

  const entryMapToArchitecture = useMemo(() => {
    const map: Record<string, Array<[string, StarterKit]>> = {};

    Object.entries(STARTER_KITS).forEach(([id, starterKit]) => {
      const architecture = starterKit.architecture;
      if (architecture) {
        // Merge memgpt_v2_agent into memgpt group for display purposes
        const displayArchitecture = architecture === 'memgpt_v2_agent' ? 'memgpt' : architecture;

        if (!map[displayArchitecture]) {
          map[displayArchitecture] = [];
        }
        map[displayArchitecture].push([id, starterKit]);
      }
    });

    return map;
  }, []);

  const t = useTranslations('components/StarterKitSelector');
  const currentStarterKits = useMemo(() => {
    const starterKits = entryMapToArchitecture[currentArchitecture];
    if (!starterKits) {
      return [];
    }
    return starterKits;
  }, [entryMapToArchitecture, currentArchitecture]);

  return (
    <VStack className="min-h-[610px]">
      {architectures.length > 1 && (
        <ArchitectureSelector
          architectures={architectures}
          currentArchitecture={currentArchitecture}
          onChange={(architecture) => {
            setCurrentArchitecture(architecture);
          }}
        />
      )}
      {currentArchitecture === 'sleeptime' && (
        <Alert title={t('sleeptimeAlert.title')} variant="brand" />
      )}
      <NiceGridDisplay itemWidth="250px" itemHeight="260px">
        {currentStarterKits.map(([id, starterKit]) => {
          return (
            <StarterKitItems
              onSelectStarterKit={onSelectStarterKit}
              key={id}
              starterKit={starterKit}
            />
          );
        })}
      </NiceGridDisplay>
    </VStack>
  );
}
