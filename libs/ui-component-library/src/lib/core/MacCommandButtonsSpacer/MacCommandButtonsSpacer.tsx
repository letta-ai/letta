import * as React from 'react';
import { CURRENT_RUNTIME } from '@letta-cloud/config-runtime';
import { get } from 'lodash-es';

export function MacCommandButtonsSpacer() {
  if (CURRENT_RUNTIME !== 'letta-desktop') {
    return null;
  }

  const isWindows = get(window, 'electron.platform') === 'win32';

  if (isWindows) {
    return null;
  }

  return <div className="min-w-[83px] h-full block"></div>;
}
