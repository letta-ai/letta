import * as React from 'react';
import type { IconWrapperProps } from '../../icons/IconWrapper';
import { PythonIcon } from '../../icons';

interface ToolLanguageIconProps extends Omit<IconWrapperProps, 'children'> {
  sourceType: string;
}

export function ToolLanguageIcon(props: ToolLanguageIconProps) {
  const { sourceType, ...rest } = props;
  switch (sourceType) {
    case 'python':
      return <PythonIcon {...rest} />;
    default:
      return null;
  }
}
