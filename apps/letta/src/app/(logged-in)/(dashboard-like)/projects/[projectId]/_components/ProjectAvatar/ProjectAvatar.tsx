'use client';

import { useCurrentProject } from '../../hooks';
import { Avatar } from '@letta-web/component-library';
import React from 'react';

export function ProjectAvatar() {
  const { name } = useCurrentProject();

  return (
    <>
      <Avatar name={name} />
      {name}
    </>
  );
}
