'use client';
import React, { useState } from 'react';
import {
  Button,
  Panel,
  PanelBar,
  PanelHeader,
} from '@letta-web/component-library';
import { ADENavigationItem } from '../common/ADENavigationItem/ADENavigationItem';

export function DataSourcesPanel() {
  const [search, setSearch] = useState('');

  return (
    <Panel
      width="compact"
      id={['sidebar', 'data-sources']}
      trigger={<ADENavigationItem title="Data Sources" />}
    >
      <PanelHeader title="Data Sources" />
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
