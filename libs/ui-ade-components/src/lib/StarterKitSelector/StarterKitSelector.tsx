import {
  NiceGridDisplay,
  StarterKitItems,
} from '@letta-cloud/ui-component-library';
import {
  STARTER_KITS,
  StarterKit,
} from '@letta-cloud/config-agent-starter-kits';
import { useMemo } from 'react';
import { useFeatureFlag } from '@letta-cloud/sdk-web';

interface StarterKitSelectorProps {
  onSelectStarterKit: (title: string, starterKit: StarterKit) => void;
  starterKitsToExclude?: Array<keyof typeof STARTER_KITS>;
}

export function StarterKitSelector(props: StarterKitSelectorProps) {
  const { onSelectStarterKit, starterKitsToExclude = [] } = props;

  const { data: isSleepTimeEnabled } = useFeatureFlag('SLEEP_TIME_AGENTS');

  const starterKits = useMemo(() => {
    return Object.entries(STARTER_KITS).filter(([id]) => {
      if (starterKitsToExclude.includes(id as keyof typeof STARTER_KITS)) {
        return false;
      }

      if (id === 'sleepTime') {
        return isSleepTimeEnabled;
      }

      return true;
    });
  }, [starterKitsToExclude, isSleepTimeEnabled]);

  return (
    <NiceGridDisplay itemWidth="250px" itemHeight="260px">
      {starterKits.map(([id, starterKit]) => (
        <StarterKitItems
          onSelectStarterKit={onSelectStarterKit}
          key={id}
          starterKit={starterKit}
        />
      ))}
    </NiceGridDisplay>
  );
}
