'use client';
import React, { useState } from 'react';
import { Button, Panel, PanelBar } from '@letta-web/component-library';
import { NavigationItem } from '../common/ADENavigationItem/ADENavigationItem';

export function ToolsPanel() {
  const [search, setSearch] = useState('');

  return (
    <Panel
      width="compact"
      title="Tools"
      id={['sidebar', 'tools']}
      trigger={<NavigationItem title="Tools" />}
    >
      <PanelBar
        onSearch={(value) => {
          setSearch(value);
        }}
        searchValue={search}
        actions={
          <>
            <Button size="small" color="tertiary" label="Import Tool" />
            <Button size="small" color="secondary" label="Add Tool" />
          </>
        }
      />
    </Panel>
  );
}
