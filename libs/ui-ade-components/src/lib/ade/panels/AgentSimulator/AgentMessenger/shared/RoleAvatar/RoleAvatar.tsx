import { HStack, LettaInvaderIcon, PersonIcon, Typography } from '@letta-cloud/ui-component-library';
import { cn } from '@letta-cloud/ui-styles';
import { Slot } from '@radix-ui/react-slot';
import type { MessageRole } from '@letta-cloud/sdk-core';
import { useMemo } from 'react';
import { useTranslations } from '@letta-cloud/translations';
import { StepLine } from '../StepLine/StepLine';

interface RoleAvatarProps {
  role: MessageRole;
  userName?: string;
}

function useRoleInfo(role: MessageRole) {
  const t = useTranslations('AgentMessenger/RoleAvatar');
  return useMemo(() => {
    switch (role) {
      case 'user':
        return {
          name: t('user'),
          icon: <PersonIcon />,
          backgroundColor: '#E0E7FF', // Indigo 100
          namePosition: 'right' as const,
        };
      default:
        return {
          name: t('assistant'),
          icon: <LettaInvaderIcon color="white" />,
          backgroundColor: 'hsl(var(--primary))',
          textColor: 'hsl(var(--color-primary-content))',
          namePosition: 'left' as const,
        };
    }
  }, [role, t]);
}

export function RoleAvatar(props: RoleAvatarProps) {
  const { role, userName } = props;


  const { name, icon, backgroundColor, namePosition, textColor } = useRoleInfo(role);

  return (
    <HStack position="relative" align="center" className={cn('justify-end', namePosition === 'left' ? 'flex-row-reverse ' : ' ')}>
      <Typography uppercase variant="body4" bold>{userName ||name}</Typography>
      <div
        style={{ backgroundColor, color: textColor, marginLeft: '-1px' }}
        className="rounded-full z-[1] bg-gray-200 w-5 h-5 flex items-center justify-center"
      >
        <Slot className="w-[12px] h-[12px]">
          {icon}
        </Slot>
      </div>
      <StepLine />
    </HStack>
  );
}
