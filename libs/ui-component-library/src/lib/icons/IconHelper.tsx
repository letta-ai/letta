import React, { useCallback } from 'react';

import * as icons from '../icons';

export * from './index';

interface IconWrapperProps {
  Icon: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Generic icon component prop
  name: string;
}

function IconWrapper({ Icon, name }: IconWrapperProps) {
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopy = useCallback(
    async function handleCopy() {
      await navigator.clipboard.writeText(`<${name} />`);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 500);
    },
    [name],
  );

  return (
    <button
      onClick={() => {
        void handleCopy();
      }}
      className="rounded-sm p-2 w-[40px] max-h-[40px] border flex-1 flex flex-col items-center"
    >
      {isCopied ? <icons.CheckIcon className="text-green-500" /> : <Icon />}
    </button>
  );
}

export function IconHelper() {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(icons).map(([name, Icon]) => (
        <IconWrapper Icon={Icon} name={name} key={name} />
      ))}
    </div>
  );
}
