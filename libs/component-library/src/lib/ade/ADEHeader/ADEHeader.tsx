'use client';
import * as React from 'react';
import { HStack } from '../../framing/HStack/HStack';
import { Tooltip } from '../../core/Tooltip/Tooltip';
import Link from 'next/link';
import { Logo } from '../../marketing/Logo/Logo';
import { Typography } from '../../core/Typography/Typography';
import { useTranslations } from 'next-intl';

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

  const { project, agent } = props;
  const { url: projectUrl, name: projectName } = project;
  const { name: agentName } = agent;

  return (
    <HStack
      justify="spaceBetween"
      align="center"
      border
      className="h-[40px] min-h-[40px] relative"
      fullWidth
      color="background"
    >
      <HStack align="center" fullHeight>
        <HStack
          align="center"
          justify="center"
          color="primary"
          className="w-[40px]"
          fullHeight
        >
          <Tooltip content={t('returnToHome')}>
            <Link href="/">
              <Logo size="small" />
            </Link>
          </Tooltip>
        </HStack>
        /
        <Tooltip content={t('returnToProjectHome')}>
          <Link href={projectUrl}>
            <Typography>{projectName}</Typography>
          </Link>
        </Tooltip>
        /<Typography>{agentName}</Typography>
      </HStack>
      {props.children}
    </HStack>
  );
}
