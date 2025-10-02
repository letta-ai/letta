import {
  EyeOpenIcon,
  HStack,
  InfoChip,
  InvaderSharedAgentIcon,
  MoveUpIcon,
  SharedAgentsPopover,
  VisibilityLockIcon,
  type SharedAgent,
} from '@letta-cloud/ui-component-library';
import { cn } from '@letta-cloud/ui-styles';
import { useTranslations } from '@letta-cloud/translations';

interface MemoryCardInfoChipsInterface {
  sharedAgents?: SharedAgent[];
  readOnly?: boolean | null | undefined;
  preserveOnMigration?: boolean | null | undefined;
  openInAdvanced?: VoidFunction;
}

export function MemoryCardInfoChips({
  sharedAgents,
  readOnly,
  preserveOnMigration,
  openInAdvanced,
}: MemoryCardInfoChipsInterface) {
  const t = useTranslations('components/CoreMemoryCard');
  return (
    <HStack align="center">
      <HStack align="center" className={cn('relative')}>
        <HStack
          gap="small"
          className={cn('absolute right-0')}
          onClick={(e) => e.stopPropagation()}
        >
          {readOnly ? (
            <InfoChip
              onClick={openInAdvanced}
              label={t('readOnly')}
              icon={<VisibilityLockIcon />}
            />
          ) : (
            <InfoChip
              onClick={openInAdvanced}
              label={t('editable')}
              icon={<EyeOpenIcon />}
            />
          )}
          {preserveOnMigration && (
            <InfoChip
              onClick={openInAdvanced}
              label={t('preserved')}
              icon={<MoveUpIcon />}
            />
          )}
          {sharedAgents && sharedAgents.length > 0 && (
            <SharedAgentsPopover
              agents={sharedAgents}
              trigger={
                <InfoChip
                  as="div"
                  variant="brand"
                  value={`${sharedAgents.length}`}
                  label={t('sharedAgents', {
                    count: `${sharedAgents.length}`,
                  })}
                  icon={<InvaderSharedAgentIcon />}
                />
              }
            ></SharedAgentsPopover>
          )}
        </HStack>
      </HStack>
    </HStack>
  );
}
