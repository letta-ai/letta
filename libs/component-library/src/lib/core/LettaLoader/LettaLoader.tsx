import * as React from 'react';
import type { LogoBaseProps } from '../../marketing/Logo/Logo';
import { Logo } from '../../marketing/Logo/Logo';
import './LettaLoader.scss';

interface LettaLoaderProps {
  size: LogoBaseProps['size'];
}

export function LettaLoader(props: LettaLoaderProps) {
  const { size } = props;
  return (
    <div className="letta-loader">
      <Logo size={size} />
    </div>
  );
}
