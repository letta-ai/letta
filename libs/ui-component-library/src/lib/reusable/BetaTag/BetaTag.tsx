import * as React from 'react';
import { Badge } from '../../core/Badge/Badge';

export function BetaTag() {
  return (
    <Badge
      className="text-text-lighter px-1"
      border
      content="Beta"
      size="small"
    />
  );
}
