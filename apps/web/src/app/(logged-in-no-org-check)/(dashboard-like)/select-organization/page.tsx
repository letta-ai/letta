'use client';
import React, { useCallback } from 'react';
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
import { useTranslations } from '@letta-cloud/translations';
import { webApi } from '$web/client';
import type { ListUserOrganizationsItemSchemaType } from '$web/web-api/contracts';
import { queryClientKeys } from '$web/web-api/contracts';
import { CenteredPageCard } from '$web/client/components';
import { useCurrentUser } from '$web/client/hooks';

interface OrganizationRowProps {
  name: string;
  id: string;
  onSelect: () => void;
}

function OrganizationRow(props: OrganizationRowProps) {
  const { name, onSelect } = props;
  const t = useTranslations('select-organization');

  return (
    <HStack borderBottom padding="small" fullWidth align="center">
      <HStack fullWidth align="center" justify="start">
        <Avatar name={name} />
        <Typography align="left">{name}</Typography>
      </HStack>
      <Button
        color="tertiary"
        type="button"
        onClick={onSelect}
        label={t('OrganizationRow.select')}
      />
    </HStack>
  );
}

interface OrganizationsListProps {
  organizations: ListUserOrganizationsItemSchemaType[];
  onSelect: (organizationId: string) => void;
}

function OrganizationsList(props: OrganizationsListProps) {
  const { organizations, onSelect } = props;

  return organizations.map(({ id, name }) => {
    return (
      <OrganizationRow
        onSelect={() => {
          onSelect(id);
        }}
        id={id}
        name={name}
        key={id}
      />
    );
  });
}

function SelectOrganizationPage() {
  const t = useTranslations('select-organization');
  const currentUser = useCurrentUser();

  const { data: organizations, isError } =
    webApi.user.listUserOrganizations.useQuery({
      queryKey: queryClientKeys.user.listUserOrganizations,
    });

  const {
    mutate,
    isPending,
    isSuccess,
    isError: updateError,
  } = webApi.user.updateActiveOrganization.useMutation({
    onSuccess: () => {
      window.location.href = '/';
    },
  });

  const handleOrganizationSelect = useCallback(
    (organizationId: string) => {
      mutate({
        body: {
          activeOrganizationId: organizationId,
        },
      });
    },
    [mutate],
  );

  if (isPending || isSuccess || updateError) {
    return (
      <LoadingEmptyStatusComponent
        emptyMessage=""
        loadingMessage={t('selectingOrganization')}
        isError={updateError}
        isLoading={isPending || isSuccess}
        errorMessage={t('errorSelectingOrganization')}
      />
    );
  }

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
          <OrganizationsList
            onSelect={handleOrganizationSelect}
            organizations={organizations.body.organizations}
          />
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
