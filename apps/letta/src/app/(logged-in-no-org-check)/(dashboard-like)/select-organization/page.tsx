'use client';
import React from 'react';
import {
  Alert,
  Avatar,
  Button,
  Frame,
  HStack,
  LoadingEmptyStatusComponent,
  Typography,
  VStack,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';
import { webApi } from '$letta/client';
import type { ListUserOrganizationsItemSchemaType } from '$letta/web-api/contracts';
import { queryClientKeys } from '$letta/web-api/contracts';
import { CenteredPageCard } from '$letta/client/components';
import { useCurrentUser } from '$letta/client/hooks';

interface OrganizationRowProps {
  name: string;
  id: string;
}

function OrganizationRow(props: OrganizationRowProps) {
  const { name, id } = props;
  const t = useTranslations('select-organization');

  const { mutate, isPending } =
    webApi.user.updateActiveOrganization.useMutation({
      onSuccess: () => {
        window.location.href = '/';
      },
    });

  return (
    <HStack borderBottom padding="small" fullWidth align="center">
      <HStack fullWidth align="center" justify="start">
        <Avatar name={name} />
        <Typography align="left">{name}</Typography>
      </HStack>
      <Button
        busy={isPending}
        color="tertiary"
        type="button"
        onClick={() => {
          mutate({ body: { activeOrganizationId: id } });
        }}
        label={t('OrganizationRow.select')}
      />
    </HStack>
  );
}

interface OrganizationsListProps {
  organizations: ListUserOrganizationsItemSchemaType[];
}

function OrganizationsList(props: OrganizationsListProps) {
  const { organizations } = props;

  return organizations.map(({ id, name }) => {
    return <OrganizationRow id={id} name={name} key={id} />;
  });
}

function SelectOrganizationPage() {
  const t = useTranslations('select-organization');
  const currentUser = useCurrentUser();

  const { data: organizations, isError } =
    webApi.user.listUserOrganizations.useQuery({
      queryKey: queryClientKeys.user.listUserOrganizations,
    });

  return (
    <CenteredPageCard title={t('title')}>
      <Alert variant="warning" title={t('missingOrg')} />
      {/* eslint-disable-next-line react/forbid-component-props */}
      <VStack className="max-h-[400px] min-h-[400px]" overflowY="auto">
        {!organizations?.body.organizations.length ? (
          <LoadingEmptyStatusComponent
            isError={isError}
            emptyMessage={t('empty')}
            loadingMessage={t('loading')}
            isLoading={!organizations}
          />
        ) : (
          <OrganizationsList organizations={organizations.body.organizations} />
        )}
      </VStack>
      {currentUser?.hasCloudAccess && (
        <Frame borderTop padding>
          <Button
            href="/create-organization"
            fullWidth
            label={t('createNewOrganization')}
          />
        </Frame>
      )}
    </CenteredPageCard>
  );
}

export default SelectOrganizationPage;
