'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ProjectSelector } from '$letta/client/components';
import {
  HiddenOnMobile,
  HStack,
  Logo,
  Tooltip,
  VisibleOnMobile,
  Typography,
} from '@letta-web/component-library';

interface ADEHeaderProps {
  children?: React.ReactNode;
  agent: {
    name: string;
  };
}

function LogoContainer() {
  const t = useTranslations('ADE/ADEHeader');

  return (
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
  );
}

export function ADEHeader(props: ADEHeaderProps) {
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
      <HiddenOnMobile>
        <HStack align="center" fullHeight gap={false}>
          <LogoContainer />
          <ProjectSelector />
          <Typography variant="body2">/</Typography>
          <HStack paddingLeft="small">
            <Typography variant="body2">{agentName}</Typography>
          </HStack>
        </HStack>
        {props.children}
      </HiddenOnMobile>
      <VisibleOnMobile>
        <HStack
          position="relative"
          align="center"
          fullWidth
          fullHeight
          gap={false}
        >
          <LogoContainer />
          <HStack justify="center" fullWidth align="center">
            <Typography variant="body2">{agentName}</Typography>
          </HStack>
        </HStack>
        {props.children}
      </VisibleOnMobile>
    </HStack>
  );
}
