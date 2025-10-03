import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Avatar, Button, ChevronDownIcon, ChevronUpIcon, PersonIcon, Popover, SystemIcon, VStack } from '@letta-cloud/ui-component-library';
import { IdentitiesService, type Identity } from '@letta-cloud/sdk-core';
import { useCurrentAgent } from '../../../../../../hooks';
import { useTranslations } from '@letta-cloud/translations';
import { useDefaultRole } from '../useDefaultRole';

export interface RoleOption {
  value: string;
  label: string;
  identityId?: string;
  icon?: React.ReactNode;
  color?: {
    text: string;
    background: string;
  };
}

function useSimulatorIdentities(): Identity[] {
  const { identity_ids } = useCurrentAgent();
  const [identities, setIdentities] = useState<Identity[]>([]);

  useEffect(() => {
    if (identity_ids && identity_ids.length > 0) {
      const promises = identity_ids.map((identityId) =>
        IdentitiesService.retrieveIdentity({ identityId }),
      );
      Promise.all(promises)
        .then((results) => {
          setIdentities(results);
        })
        .catch((error) => {
          console.error('Error fetching identities:', error);
        });
    }
  }, [identity_ids]);

  return identities;
}

interface AgentMessengerRoleSelectorProps {
  role: RoleOption;
  setRole: Dispatch<SetStateAction<RoleOption>>;
  disabled?: boolean;
}

export function AgentMessengerRoleSelector(props: AgentMessengerRoleSelectorProps) {
  const { role, setRole, disabled } = props;
  const [open, setOpen] = useState(false);
  const t = useTranslations('AgentMessenger/AgentMessengerRoleSelector');
  const identities = useSimulatorIdentities();
  const defaultRole = useDefaultRole();

  const roles = useMemo(() => {
    return [
      ...(identities.length > 0
        ? identities.map((identity) => ({
            value: identity?.identity_type || '',
            identityId: identity?.id || '',
            label: identity?.name || '',
            icon: <Avatar name={identity?.name || ''} size="xsmall" />,
          }))
        : []),
      {
        ...defaultRole,
        icon: <PersonIcon />,
      },
      {
        value: 'system',
        label: t('role.system'),
        icon: <SystemIcon />,
      },
    ];
  }, [identities, defaultRole, t]);

  if (roles.length <= 1) {
    return null;
  }

  return (
    <Popover
      className="w-auto"
      open={open}
      onOpenChange={setOpen}
      side="top"
      align="end"
      triggerAsChild
      trigger={
        <Button
          label={role.label}
          preIcon={role.icon}
          color="tertiary"
          size="small"
          active={open}
          postIcon={open ? <ChevronUpIcon /> : <ChevronDownIcon />}
          disabled={disabled}
        />
      }
    >
      <VStack gap={false}>
        {roles.map((r) => (
          <Button
            key={r.value + '_' + r.identityId}
            label={r.label}
            color="tertiary"
            preIcon={r.icon}
            onClick={() => {
              setOpen(false);
              setRole(r);
            }}
          />
        ))}
      </VStack>
    </Popover>
  );
}
