'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ProjectSelector } from '$letta/client/components';
import {
  HStack,
  Logo,
  Tooltip,
  Typography,
} from '@letta-web/component-library';

interface ADEHeaderProps {
  children?: React.ReactNode;
  project: {
    url: string;
    name: string;
  };
  agent: {
    name: string;
  };
}

export function ADEHeader(props: ADEHeaderProps) {
  const t = useTranslations('ADE/ADEHeader');

  const { agent } = props;
  const { name: agentName } = agent;

  return (
    <HStack
      justify="spaceBetween"
      align="center"
      border
      /* eslint-disable-next-line react/forbid-component-props */
      className="h-[40px] min-h-[40px] relative"
      fullWidth
      color="background"
    >
      <HStack align="center" fullHeight gap={false}>
        <HStack
          align="center"
          justify="center"
          color="primary"
          /* eslint-disable-next-line react/forbid-component-props */
          className="w-[40px]"
          fullHeight
        >
          <Tooltip content={t('returnToHome')}>
            <Link href="/">
              <Logo size="small" />
            </Link>
          </Tooltip>
        </HStack>
        <ProjectSelector />
        <Typography variant="body2">/</Typography>
        <HStack paddingLeft="small">
          <Typography variant="body2">{agentName}</Typography>
        </HStack>
      </HStack>
      {props.children}
    </HStack>
  );
}
