'use client';
import React, { useState } from 'react';
import { Button, Panel, PanelBar } from '@letta-web/component-library';
import { ADENavigationItem } from '../common/ADENavigationItem/ADENavigationItem';

export function DataSourcesPanel() {
  const [search, setSearch] = useState('');

  return (
    <Panel
      title="Data Sources"
      id="data-sources-panel"
      trigger={<ADENavigationItem title="Data Sources" />}
    >
      <PanelBar
        onSearch={(value) => {
          setSearch(value);
        }}
        searchValue={search}
        actions={
          <>
            <Button size="small" color="tertiary" label="Import Data Source" />
            <Button size="small" color="secondary" label="Add Data Source" />
          </>
        }
      />
    </Panel>
  );
}
